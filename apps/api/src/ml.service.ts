import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  LiveCandle,
  MlAdvancedTrainingResult,
  MlBacktest,
  MlDatasetMetadata,
  MlDatasetStatus,
  MlFeatureImportance,
  MlFeedbackRecord,
  MlModelComparison,
  MlModelEvaluation,
  MlOnlineStatus,
  MlProcessedRow,
  MlRetrainResult,
  MlSignal
} from './types';

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.ML_SERVICE_URL ?? 'http://localhost:8000',
      timeout: 300_000
    });
  }

  async process(pair: string): Promise<{ pair: string; rows: MlProcessedRow[] }> {
    return this.post('/process', { pair });
  }

  async predict(pair: string, modelVersion?: string): Promise<MlSignal> {
    return this.post('/predict', { pair, modelVersion });
  }

  async predictLive(pair: string, candles: LiveCandle[], modelVersion?: string): Promise<MlSignal> {
    return this.post('/predict-live', {
      pair,
      modelVersion,
      candles: candles.map((candle) => ({
        timestamp: candle.timestamp.toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? 0
      }))
    });
  }

  async backtest(pair: string): Promise<MlBacktest> {
    return this.post('/backtest', { pair });
  }

  async retrain(version: string, feedbackRecords: MlFeedbackRecord[]): Promise<MlRetrainResult> {
    return this.post('/retrain', { version, feedbackRecords });
  }

  async evaluateModel(version: string, feedbackRecords: MlFeedbackRecord[]): Promise<MlModelEvaluation> {
    return this.post('/evaluate-model', { version, feedbackRecords });
  }

  datasetStatus(): Promise<MlDatasetStatus> {
    return this.get('/dataset/status');
  }

  datasetMetadata(): Promise<MlDatasetMetadata> {
    return this.get('/dataset/metadata');
  }

  processDataset(): Promise<MlDatasetMetadata> {
    return this.post('/dataset/process', {});
  }

  trainModel(modelType: string, timeframe: string): Promise<MlAdvancedTrainingResult> {
    return this.post('/train-model', { modelType, timeframe });
  }

  compareModels(timeframe: string, includeXgboost = false): Promise<MlModelComparison> {
    return this.post('/models/compare', { timeframe, includeXgboost });
  }

  featureImportance(version: string): Promise<MlFeatureImportance[]> {
    return this.get(`/models/${encodeURIComponent(version)}/feature-importance`);
  }

  onlineStatus(): Promise<MlOnlineStatus> {
    return this.get('/online/status');
  }

  onlineUpdate(feedbackRecords: MlFeedbackRecord[]): Promise<MlOnlineStatus> {
    return this.post('/online/update', { feedbackRecords });
  }

  private async get<T>(path: string): Promise<T> {
    try {
      const response = await this.client.get<T>(path);
      return response.data;
    } catch (error) {
      this.logFailure(path, error);
      throw new BadGatewayException(`ML service request failed for ${path}`);
    }
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.client.post<T>(path, body);
      return response.data;
    } catch (error) {
      this.logFailure(path, error);
      throw new BadGatewayException(`ML service request failed for ${path}`);
    }
  }

  private logFailure(path: string, error: unknown) {
    if (axios.isAxiosError(error)) {
      this.logger.warn(`ML service request failed for ${path}: ${error.response?.status ?? error.code ?? error.message}`);
      return;
    }

    this.logger.warn(`ML service request failed for ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}