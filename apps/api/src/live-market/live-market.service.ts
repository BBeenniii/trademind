import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { AlertsService } from '../alerts.service';
import { MlService } from '../ml.service';
import { ModelLifecycleService } from '../model-lifecycle/model-lifecycle.service';
import { PaperTradingService } from '../paper-trading/paper-trading.service';
import { PrismaService } from '../prisma.service';
import { LiveCandle, MlSignal, ProviderStatus } from '../types';
import { LiveMarketGateway } from './live-market.gateway';
import { FinnhubLiveMarketProvider } from './providers/finnhub-live-market.provider';
import { LiveMarketDataProvider } from './providers/market-data-provider.interface';
import { MockLiveMarketProvider } from './providers/mock-live-market.provider';

type LiveProviderChoice = 'mock' | 'finnhub';

@Injectable()
export class LiveMarketService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LiveMarketService.name);
  private provider?: LiveMarketDataProvider;
  private runningProvider = 'MOCK_LIVE';
  private lastSignalAt = 0;
  private lastAlertSignal?: string;
  private lastProviderFallback?: { reason: string; timestamp: number };
  private lastWorkflowErrorAt = 0;
  private firstFinnhubCandleSeen = false;

  constructor(
    private readonly alerts: AlertsService,
    private readonly gateway: LiveMarketGateway,
    private readonly lifecycle: ModelLifecycleService,
    private readonly ml: MlService,
    private readonly paper: PaperTradingService,
    private readonly prisma: PrismaService
  ) {}

  async onApplicationBootstrap() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.provider?.stop();
  }

  async start(preferredProvider?: LiveProviderChoice | string) {
    await this.provider?.stop();
    this.firstFinnhubCandleSeen = false;

    const pair = this.livePair();
    const selection = this.selectProvider(preferredProvider);
    this.provider = selection.provider;
    this.runningProvider = selection.name;

    if (selection.fallbackReason) {
      const alert = await this.createProviderFallbackAlert(selection.fallbackReason);
      if (alert) {
        this.gateway.emitAlert(alert);
      }
    }

    const status: ProviderStatus = {
      provider: selection.name,
      status: selection.fallbackReason ? 'FALLBACK' : selection.name === 'FINNHUB' ? 'CONNECTING' : 'CONNECTED',
      symbol: selection.symbol,
      reason: selection.fallbackReason
    };

    this.emitStatus(status);

    await this.provider.start(pair, (candle) => this.handleCandleSafely(candle));
    return status;
  }

  async switchProvider(provider: LiveProviderChoice) {
    this.lastSignalAt = 0;
    this.lastAlertSignal = undefined;
    return this.start(provider);
  }

  async latestState() {
    const pair = this.livePair();
    const [candles, signal, account, positions, trades, alerts, learning] = await Promise.all([
      this.prisma.marketData.findMany({
        where: { pair, source: { not: null } },
        orderBy: { timestamp: 'desc' },
        take: 120
      }),
      this.prisma.signal.findFirst({
        where: { pair },
        include: { modelVersion: { select: { version: true } } },
        orderBy: { timestamp: 'desc' }
      }),
      this.paper.getAccount(),
      this.paper.getPositions(),
      this.paper.getTrades(),
      this.alerts.findAll(),
      this.lifecycle.getLearningSummary()
    ]);

    return {
      provider: this.runningProvider,
      candles: candles.reverse(),
      signal,
      account,
      positions,
      trades,
      alerts,
      learning
    };
  }

  private async handleCandle(candle: LiveCandle) {
    if (candle.source === 'FINNHUB' && !this.firstFinnhubCandleSeen) {
      this.firstFinnhubCandleSeen = true;
      this.emitStatus({ provider: 'FINNHUB', status: 'CONNECTED', symbol: process.env.FINNHUB_SYMBOL ?? 'OANDA:EUR_USD' });
    }

    await this.prisma.marketData.create({
      data: {
        pair: candle.pair,
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        source: candle.source
      }
    });

    this.gateway.emitCandle(candle);
    await this.paper.onCandle(candle);
    await this.maybeGenerateSignal(candle.pair);
  }

  private handleCandleSafely(candle: LiveCandle) {
    // External feed or ML failures should skip a candle, not terminate the dashboard API.
    void this.handleCandle(candle).catch((error) => {
      void this.reportLiveWorkflowError(error);
    });
  }

  private async reportLiveWorkflowError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Live candle workflow skipped: ${message}`);

    const now = Date.now();
    if (now - this.lastWorkflowErrorAt < 5 * 60_000) {
      return;
    }

    this.lastWorkflowErrorAt = now;
    try {
      const alert = await this.alerts.create({
        type: 'LIVE_WORKFLOW_DEGRADED',
        severity: 'WARNING',
        message: 'A live candle workflow step failed temporarily. The API stayed online and later candles will retry.'
      });
      this.gateway.emitAlert(alert);
    } catch (alertError) {
      const alertMessage = alertError instanceof Error ? alertError.message : String(alertError);
      this.logger.warn(`Could not save live workflow alert: ${alertMessage}`);
    }
  }

  private async maybeGenerateSignal(pair: string) {
    const now = Date.now();
    const intervalMs = Number(process.env.LIVE_SIGNAL_INTERVAL_SECONDS ?? 60) * 1_000;
    // Re-running inference on every tick adds noise and unnecessary ML-service load.
    if (this.lastSignalAt && now - this.lastSignalAt < intervalMs) {
      return;
    }

    this.lastSignalAt = now;
    const rows = await this.prisma.marketData.findMany({
      where: { pair },
      orderBy: { timestamp: 'desc' },
      take: 140
    });

    const candles: LiveCandle[] = rows.reverse().map((row) => ({
      pair: row.pair,
      timestamp: row.timestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume ?? 0,
      source: (row.source as LiveCandle['source']) ?? 'MOCK_LIVE'
    }));

    const champion = await this.lifecycle.ensureChampion();
    const prediction = await this.ml.predictLive(pair, candles, champion.version);
    const signal = await this.prisma.signal.create({
      data: {
        pair: prediction.pair,
        timestamp: new Date(prediction.timestamp),
        signal: prediction.signal,
        confidence: prediction.confidence,
        closePrice: prediction.closePrice,
        rsi: prediction.features.rsi,
        smaFast: prediction.features.smaFast,
        smaSlow: prediction.features.smaSlow,
        volatility: prediction.features.volatility,
        momentum: prediction.features.momentum,
        returnPct: prediction.features.returnPct,
        reason: prediction.reason,
        source: 'LIVE',
        modelVersionId: champion.id
      },
      include: { modelVersion: { select: { version: true } } }
    });

    this.gateway.emitSignal(signal);
    await this.alertForSignal(prediction);
    await this.paper.onSignal({ ...prediction, signalId: signal.id });
  }

  private async alertForSignal(signal: MlSignal) {
    if (signal.signal === 'HOLD' || signal.confidence < 0.65) {
      return;
    }

    // Similar repeated signals are useful on the chart but should not flood alert history.
    const signature = `${signal.pair}:${signal.signal}:${Math.round(signal.confidence * 10)}`;
    if (this.lastAlertSignal === signature) {
      return;
    }

    this.lastAlertSignal = signature;
    const alert = await this.alerts.create({
      type: 'LIVE_SIGNAL',
      severity: signal.confidence >= 0.75 ? 'WARNING' : 'INFO',
      message: `${signal.pair} live ${signal.signal} signal at ${(signal.confidence * 100).toFixed(1)}% confidence.`
    });
    this.gateway.emitAlert(alert);
  }

  private selectProvider(preferredProvider?: LiveProviderChoice | string) {
    // Mock-live keeps the research demo usable without a paid feed or an open FX market.
    const provider = (preferredProvider ?? process.env.LIVE_MARKET_PROVIDER ?? 'mock').toLowerCase();
    const pair = this.livePair();

    if (provider === 'finnhub') {
      if (!process.env.FINNHUB_API_KEY) {
        return {
          name: 'MOCK_LIVE',
          symbol: pair,
          provider: new MockLiveMarketProvider(),
          fallbackReason: 'Finnhub API key is missing; using mock-live mode.'
        };
      }

      const symbol = process.env.FINNHUB_SYMBOL ?? 'OANDA:EUR_USD';
      const marketClosedReason = this.finnhubMarketClosedReason(symbol);
      if (marketClosedReason) {
        return {
          name: 'MOCK_LIVE',
          symbol: pair,
          provider: new MockLiveMarketProvider(),
          fallbackReason: marketClosedReason
        };
      }

      return {
        name: 'FINNHUB',
        symbol,
        provider: new FinnhubLiveMarketProvider(
          process.env.FINNHUB_API_KEY,
          symbol,
          (reason) => void this.fallbackToMock(pair, reason).catch((error) => this.reportLiveWorkflowError(error))
        )
      };
    }

    if (provider === 'polygon' && process.env.POLYGON_API_KEY) {
      void this.createProviderFallbackAlert('Polygon live provider is reserved for a future version; using mock-live mode.');
    }

    return { name: 'MOCK_LIVE', symbol: pair, provider: new MockLiveMarketProvider() };
  }

  private async fallbackToMock(pair: string, reason: string) {
    await this.provider?.stop();
    const alert = await this.createProviderFallbackAlert(reason);
    if (alert) {
      this.gateway.emitAlert(alert);
    }

    this.provider = new MockLiveMarketProvider();
    this.runningProvider = 'MOCK_LIVE';
    this.emitStatus({ provider: 'MOCK_LIVE', status: 'FALLBACK', reason });
    await this.provider.start(pair, (candle) => this.handleCandleSafely(candle));
  }

  private createProviderFallbackAlert(reason: string) {
    const now = Date.now();
    // Provider outages can repeat quickly during reconnects, so report each reason sparingly.
    if (this.lastProviderFallback?.reason === reason && now - this.lastProviderFallback.timestamp < 5 * 60_000) {
      return undefined;
    }

    this.lastProviderFallback = { reason, timestamp: now };
    return this.alerts.create({
      type: 'PROVIDER_FALLBACK',
      severity: 'WARNING',
      message: reason
    });
  }

  private finnhubMarketClosedReason(symbol: string) {
    if (!symbol.toUpperCase().startsWith('OANDA:')) {
      return undefined;
    }

    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const fxWeekendClosed = day === 6 || (day === 5 && hour >= 21) || (day === 0 && hour < 21);

    return fxWeekendClosed
      ? 'EUR/USD spot FX is closed for the weekend, so Finnhub is unlikely to stream ticks right now; using mock-live mode.'
      : undefined;
  }

  private emitStatus(status: ProviderStatus) {
    this.gateway.emitProviderStatus(status);
  }

  private livePair() {
    return process.env.LIVE_PAIR ?? 'EURUSD';
  }
}