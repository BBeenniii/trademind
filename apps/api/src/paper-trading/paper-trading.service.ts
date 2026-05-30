import { Injectable } from '@nestjs/common';
import { AlertsService } from '../alerts.service';
import { LiveMarketGateway } from '../live-market/live-market.gateway';
import { ModelFeedbackService } from '../model-feedback/model-feedback.service';
import { PrismaService } from '../prisma.service';
import { LiveCandle, PaperSignal } from '../types';

@Injectable()
export class PaperTradingService {
  // This service only records simulations. There is deliberately no broker order API.
  constructor(
    private readonly alerts: AlertsService,
    private readonly feedback: ModelFeedbackService,
    private readonly gateway: LiveMarketGateway,
    private readonly prisma: PrismaService
  ) {}

  async getAccount() {
    return this.ensureAccount();
  }

  async getPositions() {
    const account = await this.ensureAccount();
    return this.prisma.paperPosition.findMany({
      where: { accountId: account.id },
      orderBy: { entryTime: 'desc' }
    });
  }

  async getTrades() {
    const account = await this.ensureAccount();
    return this.prisma.trade.findMany({
      where: { paperAccountId: account.id, mode: 'PAPER' },
      include: {
        signal: {
          include: { modelVersion: { select: { version: true } } }
        }
      },
      orderBy: { entryTime: 'desc' },
      take: 100
    });
  }

  async reset() {
    await this.prisma.paperAccount.deleteMany({ where: { isActive: true } });
    const account = await this.createAccount();
    this.gateway.emitPaperAccount(account);
    return account;
  }

  async onCandle(candle: LiveCandle) {
    if (!this.enabled()) {
      return;
    }

    const account = await this.ensureAccount();
    const positions = await this.prisma.paperPosition.findMany({
      where: { accountId: account.id, pair: candle.pair, status: 'OPEN' }
    });

    for (const position of positions) {
      const unrealizedPnl = this.pnl(position.direction, position.entryPrice, candle.close, position.size);
      const shouldStop =
        position.direction === 'LONG'
          ? position.stopLoss !== null && candle.close <= position.stopLoss
          : position.stopLoss !== null && candle.close >= position.stopLoss;
      const shouldTakeProfit =
        position.direction === 'LONG'
          ? position.takeProfit !== null && candle.close >= position.takeProfit
          : position.takeProfit !== null && candle.close <= position.takeProfit;

      if (shouldStop || shouldTakeProfit) {
        await this.closePosition(position.id, candle.close, candle.timestamp, shouldStop ? 'STOP_LOSS' : 'TAKE_PROFIT');
        continue;
      }

      const updated = await this.prisma.paperPosition.update({
        where: { id: position.id },
        data: {
          currentPrice: candle.close,
          unrealizedPnl
        }
      });
      this.gateway.emitPosition(updated);
    }

    await this.refreshAccount(account.id);
  }

  async onSignal(signal: PaperSignal) {
    if (!this.enabled() || signal.signal === 'HOLD' || signal.confidence < this.minConfidence()) {
      return;
    }

    const account = await this.ensureAccount();
    const desiredDirection = signal.signal === 'BUY' ? 'LONG' : 'SHORT';
    // The demo keeps at most one open position per pair so outcomes stay explainable.
    const open = await this.prisma.paperPosition.findFirst({
      where: { accountId: account.id, pair: signal.pair, status: 'OPEN' },
      orderBy: { entryTime: 'desc' }
    });

    if (open?.direction === desiredDirection) {
      return;
    }

    if (open) {
      await this.closePosition(open.id, signal.closePrice, new Date(signal.timestamp), 'SIGNAL_REVERSE');
    }

    await this.openPosition(account.id, desiredDirection, signal);
  }

  private async openPosition(accountId: number, direction: 'LONG' | 'SHORT', signal: PaperSignal) {
    // Fixed notional sizing is intentional here; this is not a production risk engine.
    const size = this.tradeSize();
    const stopPct = this.stopLossPct();
    const takeProfitPct = this.takeProfitPct();
    const entryPrice = signal.closePrice;
    const stopLoss = direction === 'LONG' ? entryPrice * (1 - stopPct) : entryPrice * (1 + stopPct);
    const takeProfit = direction === 'LONG' ? entryPrice * (1 + takeProfitPct) : entryPrice * (1 - takeProfitPct);

    const position = await this.prisma.paperPosition.create({
      data: {
        accountId,
        signalId: signal.signalId,
        pair: signal.pair,
        direction,
        entryTime: new Date(signal.timestamp),
        entryPrice,
        currentPrice: entryPrice,
        size,
        stopLoss,
        takeProfit
      }
    });

    const alert = await this.alerts.create({
      type: 'PAPER_TRADE_OPENED',
      severity: 'INFO',
      message: `${signal.pair} opened ${direction} paper position at ${entryPrice.toFixed(5)}.`
    });

    this.gateway.emitPosition(position);
    this.gateway.emitAlert(alert);
    await this.refreshAccount(accountId);
    return position;
  }

  private async closePosition(positionId: number, exitPrice: number, exitTime: Date, reason: string) {
    const position = await this.prisma.paperPosition.findUnique({
      where: { id: positionId },
      include: { account: true }
    });
    if (!position || position.status !== 'OPEN') {
      return;
    }

    const pnl = this.pnl(position.direction, position.entryPrice, exitPrice, position.size);
    const pnlPercent = position.direction === 'LONG'
      ? (exitPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - exitPrice) / position.entryPrice;

    const [updatedPosition, trade] = await this.prisma.$transaction([
      this.prisma.paperPosition.update({
        where: { id: position.id },
        data: {
          status: 'CLOSED',
          exitPrice,
          exitTime,
          currentPrice: exitPrice,
          unrealizedPnl: 0,
          realizedPnl: pnl
        }
      }),
      this.prisma.trade.create({
        data: {
          paperAccountId: position.accountId,
          signalId: position.signalId,
          pair: position.pair,
          direction: position.direction,
          entryTime: position.entryTime,
          exitTime,
          entryPrice: position.entryPrice,
          exitPrice,
          size: position.size,
          pnl,
          pnlPercent,
          closeReason: reason,
          mode: 'PAPER'
        },
        include: {
          signal: {
            include: { modelVersion: { select: { version: true } } }
          }
        }
      })
    ]);

    const severity = reason === 'STOP_LOSS' ? 'WARNING' : 'INFO';
    const alert = await this.alerts.create({
      type: reason === 'STOP_LOSS' ? 'STOP_LOSS_HIT' : reason === 'TAKE_PROFIT' ? 'TAKE_PROFIT_HIT' : 'PAPER_TRADE_CLOSED',
      severity,
      message: `${position.pair} closed ${position.direction} paper position at ${exitPrice.toFixed(5)} (${reason}, P/L ${pnl.toFixed(2)}).`
    });

    this.gateway.emitPosition(updatedPosition);
    this.gateway.emitTrade(trade);
    this.gateway.emitAlert(alert);
    await this.feedback.recordClosedTrade(trade.id);
    await this.refreshAccount(position.accountId);
  }

  private async refreshAccount(accountId: number) {
    const account = await this.prisma.paperAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      return;
    }

    const openPositions = await this.prisma.paperPosition.findMany({
      where: { accountId, status: 'OPEN' }
    });
    const closed = await this.prisma.paperPosition.findMany({
      where: { accountId, status: 'CLOSED' }
    });

    const unrealizedPnl = openPositions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
    const realizedPnl = closed.reduce((sum, position) => sum + (position.realizedPnl ?? 0), 0);
    const updated = await this.prisma.paperAccount.update({
      where: { id: accountId },
      data: {
        realizedPnl,
        unrealizedPnl,
        cashBalance: account.startingBalance + realizedPnl,
        equity: account.startingBalance + realizedPnl + unrealizedPnl
      }
    });

    this.gateway.emitPaperAccount(updated);
    return updated;
  }

  private async ensureAccount() {
    const account = await this.prisma.paperAccount.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    return account ?? this.createAccount();
  }

  private createAccount() {
    const startingBalance = this.startingBalance();
    return this.prisma.paperAccount.create({
      data: {
        startingBalance,
        cashBalance: startingBalance,
        equity: startingBalance
      }
    });
  }

  private pnl(direction: string, entryPrice: number, exitPrice: number, size: number) {
    // P/L uses a simplified notional return and excludes spread, slippage and financing.
    const raw = direction === 'LONG'
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;
    return Number((raw * size).toFixed(2));
  }

  private enabled() {
    return (process.env.PAPER_TRADING_ENABLED ?? 'true') === 'true';
  }

  private startingBalance() {
    return Number(process.env.PAPER_STARTING_BALANCE ?? 10_000);
  }

  private tradeSize() {
    return Number(process.env.PAPER_TRADE_SIZE ?? 1_000);
  }

  private minConfidence() {
    return Number(process.env.PAPER_MIN_CONFIDENCE ?? 0.65);
  }

  private stopLossPct() {
    return Number(process.env.PAPER_STOP_LOSS_PCT ?? 0.004);
  }

  private takeProfitPct() {
    return Number(process.env.PAPER_TAKE_PROFIT_PCT ?? 0.008);
  }
}