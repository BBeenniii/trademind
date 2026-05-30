import type {
  AiSummary,
  Alert,
  BacktestRun,
  DatasetMetadata,
  DatasetStatus,
  FeatureImportance,
  FeedbackRecord,
  LiveProviderMode,
  LiveState,
  MarketData,
  PaperAccount,
  PaperPosition,
  LearningSummary,
  ModelPerformance,
  ModelTrainingRun,
  ModelVersion,
  ModelComparison,
  OnlineLearningStatus,
  ProviderStatus,
  Signal,
  Trade
} from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const PAIR = 'EURUSD';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  marketData: () => request<MarketData[]>(`/market-data?pair=${PAIR}`),
  latestSignal: () => request<Signal>(`/signals/latest?pair=${PAIR}`),
  signals: () => request<Signal[]>(`/signals?pair=${PAIR}`),
  generateSignal: () => request<Signal>(`/signals/generate?pair=${PAIR}`, { method: 'POST' }),
  latestBacktest: () => request<BacktestRun>(`/backtests/latest?pair=${PAIR}`),
  runBacktest: () => request<BacktestRun>(`/backtests/run?pair=${PAIR}`, { method: 'POST' }),
  aiSummary: () => request<AiSummary>(`/ai/summary?pair=${PAIR}`),
  generateSummary: () => request<AiSummary>(`/ai/summary/generate?pair=${PAIR}`, { method: 'POST' }),
  alerts: () => request<Alert[]>('/alerts'),
  testAlert: () => request<Alert>('/alerts/test', { method: 'POST' }),
  liveState: () => request<LiveState>('/live/state'),
  switchLiveProvider: (provider: LiveProviderMode) =>
    request<ProviderStatus>('/live/provider', { method: 'POST', body: JSON.stringify({ provider }) }),
  paperAccount: () => request<PaperAccount>('/paper/account'),
  paperPositions: () => request<PaperPosition[]>('/paper/positions'),
  paperTrades: () => request<Trade[]>('/paper/trades'),
  resetPaper: () => request<PaperAccount>('/paper/reset', { method: 'POST' }),
  models: () => request<ModelVersion[]>('/models'),
  championModel: () => request<ModelVersion>('/models/champion'),
  modelPerformance: () => request<ModelPerformance[]>('/models/performance'),
  learningSummary: () => request<LearningSummary>('/models/summary'),
  modelFeedback: () => request<FeedbackRecord[]>('/models/feedback'),
  modelTrainingRuns: () => request<ModelTrainingRun[]>('/models/training-runs'),
  retrainModel: () => request('/models/retrain', { method: 'POST' }),
  promoteModel: (id: number) => request<ModelVersion>(`/models/${id}/promote`, { method: 'POST' }),
  datasetStatus: () => request<DatasetStatus>('/dataset/status'),
  datasetMetadata: () => request<DatasetMetadata>('/dataset/metadata'),
  processDataset: () => request<DatasetMetadata>('/dataset/process', { method: 'POST' }),
  trainAdvancedModel: (input: { modelType: string; timeframe: string }) =>
    request('/models/train', { method: 'POST', body: JSON.stringify(input) }),
  compareModels: (input: { timeframe: string; includeXgboost?: boolean }) =>
    request<ModelComparison>('/models/compare', { method: 'POST', body: JSON.stringify(input) }),
  featureImportance: (id: number) => request<FeatureImportance[]>(`/models/${id}/feature-importance`),
  onlineStatus: () => request<OnlineLearningStatus>('/models/online/status'),
  updateOnlineLearner: () => request<OnlineLearningStatus>('/models/online/update', { method: 'POST' })
};