import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertsService } from '../alerts.service';
import { LiveMarketGateway } from '../live-market/live-market.gateway';
import { MlService } from '../ml.service';
import { PrismaService } from '../prisma.service';
import { MlAdvancedTrainingResult, MlFeedbackRecord } from '../types';

@Injectable()
export class ModelLifecycleService {
  constructor(
    private readonly alerts: AlertsService,
    private readonly gateway: LiveMarketGateway,
    private readonly ml: MlService,
    private readonly prisma: PrismaService
  ) {}

  async ensureChampion() {
    const champion = await this.prisma.modelVersion.findFirst({
      where: { status: 'CHAMPION' },
      orderBy: { trainedAt: 'desc' }
    });

    return champion ?? this.prisma.modelVersion.create({
      data: {
        version: 'v1',
        status: 'CHAMPION',
        modelType: 'RANDOM_FOREST',
        trainingSamples: 0,
        notes: 'Initial demo model'
      }
    });
  }

  listModels() {
    return this.prisma.modelVersion.findMany({
      include: {
        _count: { select: { signals: true, feedbackRecords: true } }
      },
      orderBy: { trainedAt: 'desc' }
    });
  }

  getTrainingRuns() {
    return this.prisma.modelTrainingRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50
    });
  }

  getFeedbackRecords() {
    return this.prisma.feedbackRecord.findMany({
      include: {
        modelVersion: { select: { version: true } },
        trade: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async getPerformance() {
    const versions = await this.prisma.modelVersion.findMany({
      include: {
        feedbackRecords: { orderBy: { createdAt: 'desc' } },
        _count: { select: { signals: true } }
      },
      orderBy: { trainedAt: 'asc' }
    });

    return versions.map((version) => this.performanceFor(version));
  }

  async getLearningSummary() {
    const champion = await this.ensureChampion();
    const [feedbackCount, feedback, latestRun, dataset] = await Promise.all([
      this.prisma.feedbackRecord.count(),
      this.prisma.feedbackRecord.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      this.prisma.modelTrainingRun.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' }
      }),
      this.ml.datasetStatus().catch(() => ({ activeSource: 'MOCK_SAMPLE' }))
    ]);

    const since = latestRun?.finishedAt ?? champion.trainedAt;
    const newFeedbackCount = await this.prisma.feedbackRecord.count({
      where: { createdAt: { gt: since } }
    });
    const recentWins = feedback.filter((record) => record.outcome === 'WIN').length;
    const minFeedback = this.minFeedback();

    return {
      active: true,
      currentModel: champion.version,
      currentModelType: champion.modelType,
      datasetSource: dataset.activeSource,
      feedbackCount,
      newFeedbackCount,
      retrainMinFeedback: minFeedback,
      retrainRecommended: newFeedbackCount >= minFeedback,
      recentWinRate: feedback.length ? recentWins / feedback.length : 0,
      lastOutcome: feedback[0]?.outcome ?? null
    };
  }

  async retrain(trigger = 'MANUAL') {
    const champion = await this.ensureChampion();
    const feedback = await this.prisma.feedbackRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250
    });
    const version = await this.nextVersion();
    const run = await this.prisma.modelTrainingRun.create({
      data: {
        status: 'RUNNING',
        trigger,
        previousChampionId: champion.id,
        challengerVersion: version
      }
    });

    await this.createAlert('MODEL_RETRAIN_STARTED', 'INFO', `${version} retraining started with ${feedback.length} paper feedback records.`);

    try {
      const mlFeedback = feedback.map((record) => this.toMlFeedback(record));
      const [training, evaluation] = await Promise.all([
        this.ml.retrain(version, mlFeedback),
        this.ml.evaluateModel(version, mlFeedback)
      ]);
      const challenger = await this.prisma.modelVersion.create({
        data: {
          version,
          status: 'CHALLENGER',
          modelType: 'RANDOM_FOREST',
          trainingSamples: training.trainingSamples,
          validationSamples: training.validationSamples,
          accuracy: training.metrics.accuracy,
          precision: training.metrics.precision,
          recall: training.metrics.recall,
          f1Score: training.metrics.f1Score,
          winRate: evaluation.winRate,
          avgPnl: evaluation.avgPnl,
          maxDrawdown: evaluation.maxDrawdown,
          profitFactor: evaluation.profitFactor,
          artifactPath: training.artifactPath,
          datasetSource: training.dataset?.source,
          timeframe: training.dataset?.timeframe,
          trainingRows: training.split?.trainingRows,
          validationRows: training.split?.validationRows,
          testRows: training.split?.testRows,
          featureImportance: training.featureImportance,
          classDistribution: training.metrics.classDistribution,
          trainingTimeSecs: training.trainingTimeSeconds,
          notes: `Challenger trained from ${feedback.length} paper feedback records plus local historical samples.`
        }
      });
      // New models remain challengers until their validation and paper outcomes justify promotion.
      const recommended = this.shouldPromote(champion, challenger);
      await this.prisma.modelTrainingRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          samplesUsed: training.trainingSamples,
          metricsJson: { training: training.metrics, evaluation, recommended }
        }
      });

      await this.createAlert('MODEL_CHALLENGER_CREATED', 'INFO', `${version} challenger created. Manual review${recommended ? ' is recommended' : ' is required before promotion'}.`);
      await this.createAlert('MODEL_RETRAIN_COMPLETED', 'INFO', `${version} retraining completed with ${(training.metrics.accuracy * 100).toFixed(1)}% validation accuracy.`);

      // Automatic promotion is opt-in because demo metrics are not evidence of profitability.
      if (recommended && this.autoPromote()) {
        return this.promote(challenger.id);
      }

      return { challenger, recommended };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown retraining error';
      await this.prisma.modelTrainingRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', finishedAt: new Date(), errorMessage: message }
      });
      await this.createAlert('MODEL_RETRAIN_FAILED', 'WARNING', `${version} retraining failed. The current champion remains active.`);
      throw error;
    }
  }

  datasetStatus() {
    return this.ml.datasetStatus();
  }

  datasetMetadata() {
    return this.ml.datasetMetadata();
  }

  processDataset() {
    return this.ml.processDataset();
  }

  async trainModel(modelType = 'LIGHTGBM', timeframe = '5m') {
    const result = await this.ml.trainModel(modelType, timeframe);
    const model = await this.persistAdvancedModel(result);
    await this.createAlert('MODEL_CHALLENGER_CREATED', 'INFO', `${result.version} ${result.modelType} challenger trained on ${result.dataset.source}.`);
    return { model, training: result };
  }

  async compareModels(timeframe = '5m', includeXgboost = false) {
    const comparison = await this.ml.compareModels(timeframe, includeXgboost);
    const models: unknown[] = [];
    for (const result of comparison.models) {
      models.push(await this.persistAdvancedModel(result));
    }
    await this.createAlert('MODEL_COMPARISON_COMPLETED', 'INFO', `${comparison.models.length} models compared on the ${timeframe} historical dataset.`);
    return { ...comparison, storedModels: models };
  }

  async getFeatureImportance(id: number) {
    const model = await this.prisma.modelVersion.findUnique({ where: { id } });
    if (!model) {
      return [];
    }
    if (Array.isArray(model.featureImportance)) {
      return model.featureImportance;
    }
    return this.ml.featureImportance(model.version);
  }

  onlineStatus() {
    return this.ml.onlineStatus();
  }

  async updateOnlineLearner(limit = 100) {
    const feedback = await this.prisma.feedbackRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return this.ml.onlineUpdate(feedback.map((record) => this.toMlFeedback(record)));
  }

  async maybeUpdateOnlineLearner() {
    if ((process.env.ONLINE_LEARNING_ENABLED ?? 'true') !== 'true') {
      return;
    }
    const minFeedback = Number(process.env.ONLINE_LEARNING_MIN_FEEDBACK ?? 10);
    const feedbackCount = await this.prisma.feedbackRecord.count();
    // River is an experiment alongside the champion model, not a silent replacement for it.
    if (feedbackCount >= minFeedback && feedbackCount % minFeedback === 0) {
      await this.updateOnlineLearner(minFeedback);
    }
  }

  async promote(id: number) {
    const challenger = await this.prisma.modelVersion.findUnique({ where: { id } });
    if (!challenger) {
      throw new Error('Model version not found.');
    }

    await this.prisma.$transaction([
      this.prisma.modelVersion.updateMany({
        where: { status: 'CHAMPION', id: { not: id } },
        data: { status: 'ARCHIVED' }
      }),
      this.prisma.modelVersion.update({
        where: { id },
        data: { status: 'CHAMPION' }
      }),
      this.prisma.modelTrainingRun.updateMany({
        where: { challengerVersion: challenger.version },
        data: { promoted: true }
      })
    ]);

    await this.createAlert('MODEL_PROMOTED', 'INFO', `${challenger.version} promoted to champion model.`);
    return this.ensureChampion();
  }

  async checkDegradation(modelVersionId?: number | null) {
    if (!modelVersionId) {
      return;
    }

    const feedback = await this.prisma.feedbackRecord.findMany({
      where: { modelVersionId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    if (feedback.length < 30) {
      return;
    }

    const recent = feedback.slice(0, 20);
    const overallWinRate = this.winRate(feedback);
    const recentWinRate = this.winRate(recent);
    const recentAvgPnl = this.average(recent.map((record) => record.pnl));
    const recentConfidence = this.average(recent.map((record) => record.confidence));
    // High-confidence losses matter even when the longer sample still looks acceptable.
    const degrading = recentWinRate < overallWinRate - 0.15 || (recentAvgPnl < 0 && recentConfidence >= 0.65);
    if (!degrading) {
      return;
    }

    const recentAlert = await this.prisma.alert.findFirst({
      where: {
        type: 'MODEL_DEGRADATION',
        createdAt: { gt: new Date(Date.now() - 60 * 60_000) }
      }
    });
    if (!recentAlert) {
      await this.createAlert('MODEL_DEGRADATION', 'WARNING', 'Recent model performance is degrading. Retraining recommended.');
    }
  }

  @Cron('0 */6 * * *')
  async scheduledRetrain() {
    if ((process.env.MODEL_RETRAIN_SCHEDULE_ENABLED ?? 'false') !== 'true') {
      return;
    }

    const latest = await this.prisma.modelTrainingRun.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' }
    });
    const feedbackCount = await this.prisma.feedbackRecord.count({
      where: latest?.finishedAt ? { createdAt: { gt: latest.finishedAt } } : undefined
    });
    if (feedbackCount >= this.minFeedback()) {
      await this.retrain('SCHEDULED');
    }
  }

  private performanceFor(version: any) {
    const feedback = version.feedbackRecords;
    const recent = feedback.slice(0, 20);
    const highConfidence = feedback.filter((record: any) => record.confidence >= 0.7);

    return {
      id: version.id,
      version: version.version,
      status: version.status,
      modelType: version.modelType,
      trainedAt: version.trainedAt,
      accuracy: version.accuracy,
      signalCount: version._count.signals,
      feedbackCount: feedback.length,
      winRate: this.winRate(feedback),
      lossRate: feedback.length ? feedback.filter((record: any) => record.outcome === 'LOSS').length / feedback.length : 0,
      avgPnl: this.average(feedback.map((record: any) => record.pnl)),
      avgConfidence: this.average(feedback.map((record: any) => record.confidence)),
      highConfidenceWinRate: this.winRate(highConfidence),
      recentWinRate: this.winRate(recent),
      recentAvgPnl: this.average(recent.map((record: any) => record.pnl))
    };
  }

  private winRate(records: Array<{ outcome: string }>) {
    return records.length ? records.filter((record) => record.outcome === 'WIN').length / records.length : 0;
  }

  private average(values: Array<number | null | undefined>) {
    const numbers = values.filter((value): value is number => typeof value === 'number');
    return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
  }

  private async nextVersion() {
    const models = await this.prisma.modelVersion.findMany({ select: { version: true } });
    const latest = models.reduce((max, model) => {
      const number = Number(model.version.replace(/^v/, ''));
      return Number.isFinite(number) ? Math.max(max, number) : max;
    }, 0);
    return `v${latest + 1}`;
  }

  private toMlFeedback(record: any): MlFeedbackRecord {
    return {
      signal: record.signalValue,
      confidence: record.confidence,
      closePrice: record.closePrice,
      rsi: record.rsi,
      smaFast: record.smaFast,
      smaSlow: record.smaSlow,
      volatility: record.volatility,
      momentum: record.momentum,
      returnPct: record.returnPct,
      outcome: record.outcome,
      pnl: record.pnl,
      pnlPercent: record.pnlPercent
    };
  }

  private persistAdvancedModel(result: MlAdvancedTrainingResult) {
    return this.prisma.modelVersion.upsert({
      where: { version: result.version },
      update: {
        accuracy: result.metrics.accuracy,
        precision: result.metrics.precision,
        recall: result.metrics.recall,
        f1Score: result.metrics.f1Score,
        artifactPath: result.artifactPath,
        datasetSource: result.dataset.source,
        timeframe: result.dataset.timeframe,
        trainingSamples: result.split.trainingRows,
        validationSamples: result.split.validationRows,
        trainingRows: result.split.trainingRows,
        validationRows: result.split.validationRows,
        testRows: result.split.testRows,
        featureImportance: result.featureImportance,
        classDistribution: result.metrics.classDistribution,
        trainingTimeSecs: result.trainingTimeSeconds,
        notes: result.notes
      },
      create: {
        version: result.version,
        status: 'CHALLENGER',
        modelType: result.modelType,
        trainingSamples: result.split.trainingRows,
        validationSamples: result.split.validationRows,
        accuracy: result.metrics.accuracy,
        precision: result.metrics.precision,
        recall: result.metrics.recall,
        f1Score: result.metrics.f1Score,
        artifactPath: result.artifactPath,
        datasetSource: result.dataset.source,
        timeframe: result.dataset.timeframe,
        trainingRows: result.split.trainingRows,
        validationRows: result.split.validationRows,
        testRows: result.split.testRows,
        featureImportance: result.featureImportance,
        classDistribution: result.metrics.classDistribution,
        trainingTimeSecs: result.trainingTimeSeconds,
        notes: result.notes
      }
    });
  }

  private shouldPromote(champion: any, challenger: any) {
    // A challenger needs a measurable improvement without materially worsening drawdown.
    const accuracyImproved =
      challenger.accuracy !== null && (champion.accuracy === null || challenger.accuracy >= champion.accuracy + 0.02);
    const winRateImproved =
      challenger.winRate !== null && challenger.winRate > 0 && (champion.winRate === null || challenger.winRate >= champion.winRate + 0.03);
    const drawdownAcceptable =
      challenger.maxDrawdown === null ||
      champion.maxDrawdown === null ||
      Math.abs(challenger.maxDrawdown) <= Math.abs(champion.maxDrawdown) * 1.2;

    return drawdownAcceptable && (accuracyImproved || winRateImproved);
  }

  private minFeedback() {
    return Number(process.env.MODEL_RETRAIN_MIN_FEEDBACK ?? 25);
  }

  private autoPromote() {
    return (process.env.MODEL_AUTO_PROMOTE ?? 'false') === 'true';
  }

  private async createAlert(type: string, severity: string, message: string) {
    const alert = await this.alerts.create({ type, severity, message });
    this.gateway.emitAlert(alert);
    return alert;
  }
}