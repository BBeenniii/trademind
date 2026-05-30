import { Injectable } from '@nestjs/common';
import { ModelLifecycleService } from '../model-lifecycle/model-lifecycle.service';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ModelFeedbackService {
  constructor(
    private readonly lifecycle: ModelLifecycleService,
    private readonly prisma: PrismaService
  ) {}

  async recordClosedTrade(tradeId: number) {
    const existing = await this.prisma.feedbackRecord.findUnique({ where: { tradeId } });
    if (existing) {
      return existing;
    }

    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: { signal: true }
    });
    if (!trade?.exitTime) {
      return;
    }

    // Older paper rows may not have a direct relation, so recover the signal active at entry.
    const sourceSignal = trade.signal ?? await this.prisma.signal.findFirst({
      where: {
        pair: trade.pair,
        signal: { in: ['BUY', 'SELL'] },
        timestamp: { lte: trade.entryTime }
      },
      orderBy: { timestamp: 'desc' }
    });
    if (!sourceSignal) {
      return;
    }

    const marketData = await this.prisma.marketData.findMany({
      where: {
        pair: trade.pair,
        timestamp: { gte: trade.entryTime, lte: trade.exitTime }
      },
      orderBy: { timestamp: 'asc' }
    });
    const moves = marketData.map((candle) => this.signedMove(trade.direction, trade.entryPrice, candle.close));
    const pnl = trade.pnl ?? 0;
    // Keep the signal context with the trade outcome so later evaluation can inspect drift.
    const feedback = await this.prisma.feedbackRecord.create({
      data: {
        signalId: sourceSignal.id,
        modelVersionId: sourceSignal.modelVersionId,
        tradeId: trade.id,
        pair: trade.pair,
        signalValue: sourceSignal.signal,
        confidence: sourceSignal.confidence,
        closePrice: sourceSignal.closePrice,
        rsi: sourceSignal.rsi,
        smaFast: sourceSignal.smaFast,
        smaSlow: sourceSignal.smaSlow,
        volatility: sourceSignal.volatility,
        momentum: sourceSignal.momentum,
        returnPct: sourceSignal.returnPct,
        outcome: Math.abs(pnl) < 0.01 ? 'NEUTRAL' : pnl > 0 ? 'WIN' : 'LOSS',
        pnl,
        pnlPercent: trade.pnlPercent,
        holdingSeconds: Math.max(0, Math.round((trade.exitTime.getTime() - trade.entryTime.getTime()) / 1_000)),
        maxFavorableMove: moves.length ? Math.max(0, ...moves) : null,
        maxAdverseMove: moves.length ? Math.abs(Math.min(0, ...moves)) : null
      }
    });

    await this.lifecycle.checkDegradation(sourceSignal.modelVersionId);
    await this.lifecycle.maybeUpdateOnlineLearner();
    return feedback;
  }

  private signedMove(direction: string, entryPrice: number, price: number) {
    const raw = (price - entryPrice) / entryPrice;
    return direction === 'LONG' ? raw : -raw;
  }
}