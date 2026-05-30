import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AlertsService } from './alerts.service';
import { MlService } from './ml.service';
import { PrismaService } from './prisma.service';

@Injectable()
export class BacktestsService {
  constructor(
    private readonly alerts: AlertsService,
    private readonly ml: MlService,
    private readonly prisma: PrismaService
  ) {}

  async latest(pair = 'EURUSD') {
    const latest = await this.prisma.backtestRun.findFirst({
      where: { pair },
      orderBy: { createdAt: 'desc' },
      include: { trades: { orderBy: { entryTime: 'desc' }, take: 80 } }
    });

    if (latest) {
      return latest;
    }

    return this.run(pair);
  }

  async run(pair = 'EURUSD') {
    const result = await this.ml.backtest(pair);
    const metrics = result.metrics;

    const run = await this.prisma.backtestRun.create({
      data: {
        pair: result.pair,
        startDate: new Date(result.startDate),
        endDate: new Date(result.endDate),
        initialBalance: metrics.initialBalance,
        finalBalance: metrics.finalBalance,
        totalReturn: metrics.totalReturn,
        winRate: metrics.winRate,
        maxDrawdown: metrics.maxDrawdown,
        tradeCount: metrics.tradeCount,
        averageTradeReturn: metrics.averageTradeReturn,
        bestTrade: metrics.bestTrade,
        worstTrade: metrics.worstTrade,
        equityCurve: result.equityCurve as Prisma.InputJsonValue,
        drawdownCurve: result.drawdown as Prisma.InputJsonValue,
        trades: {
          create: result.trades.map((trade) => ({
            pair: trade.pair,
            entryTime: new Date(trade.entryTime),
            exitTime: trade.exitTime ? new Date(trade.exitTime) : null,
            direction: trade.direction,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            pnl: trade.pnl,
            pnlPercent: trade.pnlPercent
          }))
        }
      },
      include: { trades: { orderBy: { entryTime: 'desc' }, take: 80 } }
    });

    if (Math.abs(run.maxDrawdown) >= 0.06) {
      await this.alerts.create({
        type: 'RISK',
        severity: 'HIGH',
        message: `${run.pair} backtest drawdown reached ${(Math.abs(run.maxDrawdown) * 100).toFixed(1)}%.`
      });
    }

    return run;
  }
}