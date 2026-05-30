import { Injectable } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { MlService } from './ml.service';
import { ModelLifecycleService } from './model-lifecycle/model-lifecycle.service';
import { PrismaService } from './prisma.service';

@Injectable()
export class SignalsService {
  constructor(
    private readonly alerts: AlertsService,
    private readonly lifecycle: ModelLifecycleService,
    private readonly ml: MlService,
    private readonly prisma: PrismaService
  ) {}

  async findAll(pair = 'EURUSD') {
    return this.prisma.signal.findMany({
      where: { pair },
      include: { modelVersion: { select: { version: true } } },
      orderBy: { timestamp: 'desc' },
      take: 100
    });
  }

  async latest(pair = 'EURUSD') {
    const latest = await this.prisma.signal.findFirst({
      where: { pair },
      include: { modelVersion: { select: { version: true } } },
      orderBy: { timestamp: 'desc' }
    });

    if (latest) {
      return latest;
    }

    return this.generate(pair);
  }

  async generate(pair = 'EURUSD') {
    const champion = await this.lifecycle.ensureChampion();
    // Persist technical research signals for review this path has no broker execution.
    const prediction = await this.ml.predict(pair, champion.version);
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
        source: 'RESEARCH',
        modelVersionId: champion.id
      },
      include: { modelVersion: { select: { version: true } } }
    });

    if (signal.signal !== 'HOLD') {
      await this.alerts.create({
        type: 'SIGNAL',
        severity: signal.confidence >= 0.7 ? 'HIGH' : 'MEDIUM',
        message: `${signal.pair} generated a ${signal.signal} signal at ${(signal.confidence * 100).toFixed(1)}% confidence.`
      });
    }

    return signal;
  }
}