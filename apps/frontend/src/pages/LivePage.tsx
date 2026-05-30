import { useEffect, useMemo, useRef } from 'react';
import { Activity, BrainCircuit, CircleDollarSign, Database, Radio, RefreshCw, Shield, TrendingUp, Wallet, Wifi } from 'lucide-react';
import { ColorType, CrosshairMode, createChart } from 'lightweight-charts';
import type { CandlestickData, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { ErrorState } from '../components/ErrorState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { SignalBadge } from '../components/SignalBadge';
import { dateTime, money, percent, price } from '../format';
import { useLiveState, useResetPaper, useSwitchLiveProvider } from '../hooks';
import { useLiveSocket } from '../useLiveSocket';
import type { Alert, LiveCandle, PaperAccount, PaperPosition, ProviderStatus, Signal, Trade } from '../types';

export function LivePage() {
  const liveState = useLiveState();
  const resetPaper = useResetPaper();
  const switchProvider = useSwitchLiveProvider();
  const live = useLiveSocket(liveState.data);

  if (liveState.isError) {
    return <ErrorState message="Live mode is not reachable. Start the API, ML service and PostgreSQL, then refresh." />;
  }

  if (liveState.isLoading && !live.candles.length) {
    return <LoadingState label="Connecting live research workspace" />;
  }

  const candles = live.candles;
  const latestCandle = candles[candles.length - 1];
  const previousCandle = candles[candles.length - 2];
  const move = latestCandle && previousCandle ? latestCandle.close - previousCandle.close : 0;
  const account = live.account ?? liveState.data?.account;
  const signal = live.signal ?? liveState.data?.signal;
  const provider = live.providerStatus ?? { provider: liveState.data?.provider ?? 'MOCK_LIVE', status: 'CONNECTED' };
  const openPosition = live.openPosition;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Live EUR/USD Research</h1>
          <p className="text-sm text-muted">Mock-live or Finnhub feed, live ML signals, and simulated paper trading.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProviderSwitch
            activeProvider={provider.provider}
            pending={switchProvider.isPending}
            onSwitch={(provider) => switchProvider.mutate(provider)}
          />
          <LiveStatusBadge connected={live.connected} status={provider} />
          <IconButton
            icon={RefreshCw}
            label={resetPaper.isPending ? 'Resetting' : 'Reset Paper'}
            onClick={() => resetPaper.mutate()}
            disabled={resetPaper.isPending}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-buy/30 bg-buy/5 px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-buy">
          <BrainCircuit size={17} />
          Learning loop active
        </span>
        <span className="text-muted">Current model <strong className="text-ink">{live.learning?.currentModel ?? 'v1'} / {live.learning?.currentModelType ?? 'RANDOM_FOREST'}</strong></span>
        <span className="text-muted">Dataset <strong className="text-ink">{live.learning?.datasetSource ?? 'MOCK_SAMPLE'}</strong></span>
        <span className="text-muted">Feedback records <strong className="text-ink">{live.learning?.feedbackCount ?? 0}</strong></span>
        {live.learning?.retrainRecommended ? <span className="text-hold">Retraining review recommended</span> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LivePriceTicker candle={latestCandle} move={move} />
        <LatestSignalCard signal={signal} />
        <PaperAccountCard account={account} />
        <OpenPositionCard position={openPosition} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-md border border-line bg-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Rolling Live Candles</h2>
            <span className="text-xs text-muted">{candles.length} candles</span>
          </div>
          <div className="h-[360px]">
            <LiveChart candles={candles} />
          </div>
        </section>

        <LiveAlertsPanel alerts={live.alerts} />
      </div>

      <LiveTradeLog trades={live.trades} />
    </div>
  );
}

function ProviderSwitch({
  activeProvider,
  pending,
  onSwitch
}: {
  activeProvider: string;
  pending: boolean;
  onSwitch: (provider: 'mock' | 'finnhub') => void;
}) {
  const active = activeProvider === 'FINNHUB' ? 'finnhub' : 'mock';

  const buttonClass = (provider: 'mock' | 'finnhub') =>
    `inline-flex h-8 items-center gap-2 rounded px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
      active === provider
        ? 'bg-buy/15 text-buy shadow-[inset_0_0_0_1px_rgba(56,211,159,0.35)]'
        : 'text-muted hover:bg-panel hover:text-ink'
    }`;

  return (
    <div className="inline-flex gap-1 rounded-md border border-line bg-panelSoft p-1" aria-label="Live data source">
      <button
        type="button"
        className={buttonClass('finnhub')}
        aria-pressed={active === 'finnhub'}
        disabled={pending}
        onClick={() => onSwitch('finnhub')}
      >
        <Wifi size={15} />
        Finnhub
      </button>
      <button
        type="button"
        className={buttonClass('mock')}
        aria-pressed={active === 'mock'}
        disabled={pending}
        onClick={() => onSwitch('mock')}
      >
        <Database size={15} />
        Mock
      </button>
    </div>
  );
}

function LiveStatusBadge({ connected, status }: { connected: boolean; status: ProviderStatus }) {
  const provider = status.provider === 'MOCK_LIVE' ? 'MOCK LIVE' : status.provider;
  const tone = connected ? 'border-buy/40 bg-buy/10 text-buy' : 'border-sell/40 bg-sell/10 text-sell';

  return (
    <div className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium ${tone}`}>
      <Radio size={16} />
      <span>{connected ? 'LIVE' : 'DISCONNECTED'}</span>
      <span className="text-muted">/</span>
      <span>{provider}</span>
      {status.status === 'FALLBACK' ? <span className="text-hold">FALLBACK</span> : null}
    </div>
  );
}

function LivePriceTicker({ candle, move }: { candle?: LiveCandle; move: number }) {
  const direction = move >= 0 ? 'text-buy' : 'text-sell';
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">Live price</p>
          <p className="mt-2 text-3xl font-semibold">{price(candle?.close)}</p>
        </div>
        <div className={`rounded-md border border-line bg-panelSoft p-2 ${direction}`}>
          <TrendingUp size={18} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className={direction}>{move >= 0 ? '+' : ''}{move.toFixed(5)}</span>
        <span className="text-muted">{dateTime(candle?.timestamp)}</span>
      </div>
    </section>
  );
}

function LatestSignalCard({ signal }: { signal?: Signal | null }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">Live signal</p>
          <div className="mt-3"><SignalBadge signal={signal?.signal ?? 'HOLD'} /></div>
        </div>
        <div className="rounded-md border border-line bg-panelSoft p-2 text-muted">
          <Activity size={18} />
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        {signal ? `${percent(signal.confidence)} confidence / ${signal.modelVersion?.version ?? 'v1'}` : 'Waiting for model output'}
      </p>
      <p className="mt-1 text-xs text-muted">{dateTime(signal?.timestamp)}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{signal?.reason}</p>
    </section>
  );
}

function PaperAccountCard({ account }: { account?: PaperAccount }) {
  const pnl = account ? account.realizedPnl + account.unrealizedPnl : 0;
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">Paper equity</p>
          <p className="mt-2 text-2xl font-semibold">{money(account?.equity)}</p>
        </div>
        <div className="rounded-md border border-line bg-panelSoft p-2 text-muted">
          <Wallet size={18} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted">Cash {money(account?.cashBalance)}</span>
        <span className={pnl >= 0 ? 'text-buy' : 'text-sell'}>P/L {money(pnl)}</span>
      </div>
    </section>
  );
}

function OpenPositionCard({ position }: { position?: PaperPosition | null }) {
  if (!position) {
    return (
      <section className="rounded-md border border-line bg-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted">Open position</p>
            <p className="mt-2 text-2xl font-semibold">Flat</p>
          </div>
          <div className="rounded-md border border-line bg-panelSoft p-2 text-muted">
            <Shield size={18} />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">Waiting for a confident BUY or SELL signal.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">Open position</p>
          <p className={`mt-2 text-2xl font-semibold ${position.direction === 'LONG' ? 'text-buy' : 'text-sell'}`}>{position.direction}</p>
        </div>
        <div className="rounded-md border border-line bg-panelSoft p-2 text-muted">
          <CircleDollarSign size={18} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted">Entry {price(position.entryPrice)}</span>
        <span className="text-muted">Now {price(position.currentPrice)}</span>
        <span className="text-muted">Stop {price(position.stopLoss)}</span>
        <span className={position.unrealizedPnl >= 0 ? 'text-buy' : 'text-sell'}>{money(position.unrealizedPnl)}</span>
      </div>
    </section>
  );
}

function LiveChart({ candles }: { candles: LiveCandle[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const chartData = useMemo<CandlestickData<UTCTimestamp>[]>(() => {
    // REST hydration and socket updates can briefly overlap, so keep one candle per timestamp.
    const byTime = new Map<UTCTimestamp, CandlestickData<UTCTimestamp>>();

    for (const candle of candles) {
      const seconds = Math.floor(new Date(candle.timestamp).getTime() / 1000) as UTCTimestamp;
      if (!Number.isFinite(seconds)) {
        continue;
      }

      byTime.set(seconds, {
        time: seconds,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      });
    }

    return Array.from(byTime.values()).sort((a, b) => Number(a.time) - Number(b.time));
  }, [candles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#11151c' },
        textColor: '#8d9aab',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
      },
      grid: {
        vertLines: { color: '#202936' },
        horzLines: { color: '#202936' }
      },
      crosshair: {
        mode: CrosshairMode.Normal
      },
      rightPriceScale: {
        borderColor: '#26303d',
        scaleMargins: { top: 0.16, bottom: 0.14 }
      },
      timeScale: {
        borderColor: '#26303d',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
        barSpacing: 8
      }
    });

    const series = chart.addCandlestickSeries({
      upColor: '#38d39f',
      downColor: '#ff6876',
      borderUpColor: '#38d39f',
      borderDownColor: '#ff6876',
      wickUpColor: '#38d39f',
      wickDownColor: '#ff6876'
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    seriesRef.current?.setData(chartData);
    if (chartData.length > 1) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [chartData]);

  return (
    <div className="relative h-full overflow-hidden rounded-md border border-line bg-[#11151c]">
      <div ref={containerRef} className="h-full w-full" />
      {!chartData.length ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
          Waiting for live candles
        </div>
      ) : null}
    </div>
  );
}

function LiveTradeLog({ trades }: { trades: Trade[] }) {
  return (
    <section className="rounded-md border border-line bg-panel">
      <div className="border-b border-line p-4">
        <h2 className="text-sm font-semibold">Paper Trade Log</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Entry</th>
              <th className="px-4 py-3">Exit</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Signal</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Entry Price</th>
              <th className="px-4 py-3">Exit Price</th>
              <th className="px-4 py-3">P/L</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {trades.slice(0, 20).map((trade) => (
              <tr key={trade.id}>
                <td className="px-4 py-3 text-muted">{dateTime(trade.entryTime)}</td>
                <td className="px-4 py-3 text-muted">{dateTime(trade.exitTime)}</td>
                <td className="px-4 py-3 font-medium">{trade.direction}</td>
                <td className="px-4 py-3">{trade.signal?.signal ?? '-'}</td>
                <td className="px-4 py-3">{trade.signal?.modelVersion?.version ?? '-'}</td>
                <td className="px-4 py-3">{price(trade.entryPrice)}</td>
                <td className="px-4 py-3">{price(trade.exitPrice)}</td>
                <td className={`px-4 py-3 ${(trade.pnl ?? 0) >= 0 ? 'text-buy' : 'text-sell'}`}>{money(trade.pnl)}</td>
                <td className="px-4 py-3 text-muted">{trade.closeReason ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LiveAlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <h2 className="mb-3 text-sm font-semibold">Live Alerts</h2>
      <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
        {alerts.slice(0, 12).map((alert) => (
          <div key={alert.id} className="rounded-md border border-line bg-panelSoft p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase text-muted">{alert.type}</span>
              <span className="text-xs text-muted">{dateTime(alert.createdAt)}</span>
            </div>
            <p className="text-sm leading-5 text-ink">{alert.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}