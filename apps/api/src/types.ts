export type PairQuery = {
  pair?: string;
};

export type MlSignal = {
  pair: string;
  timestamp: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  closePrice: number;
  features: {
    rsi?: number;
    smaFast?: number;
    smaSlow?: number;
    volatility?: number;
    returnPct?: number;
    momentum?: number;
  };
  reason?: string;
};

export type PaperSignal = MlSignal & {
  signalId?: number;
};

export type MlFeedbackRecord = {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  closePrice: number;
  rsi?: number | null;
  smaFast?: number | null;
  smaSlow?: number | null;
  volatility?: number | null;
  momentum?: number | null;
  returnPct?: number | null;
  outcome: string;
  pnl?: number | null;
  pnlPercent?: number | null;
};

export type MlRetrainResult = {
  version: string;
  artifactPath: string;
  trainingSamples: number;
  validationSamples: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    classDistribution?: Record<string, number>;
  };
  dataset?: MlDatasetSummary;
  split?: MlDatasetSplit;
  featureImportance?: MlFeatureImportance[];
  testRows?: number;
  trainingTimeSeconds?: number;
};

export type MlModelEvaluation = {
  version: string;
  winRate: number;
  avgPnl: number;
  profitFactor: number;
  maxDrawdown: number;
};

export type MlDatasetMetadata = {
  source: string;
  pair: string;
  timeframe: string;
  rowCount: number;
  startDate: string;
  endDate: string;
  yearsIncluded: number[];
  missingRowsEstimate: number;
  duplicateRowsRemoved: number;
  invalidRowsRemoved: number;
  processedFilePath: string;
  generatedAt: string;
};

export type MlDatasetStatus = {
  rawDatasetDetected: boolean;
  processedDatasetExists: boolean;
  activeSource: string;
  rawFileCount: number;
  availableTimeframes: string[];
  metadata?: MlDatasetMetadata | null;
};

export type MlDatasetSummary = {
  source: string;
  timeframe: string;
  rowCount: number;
  startDate: string;
  endDate: string;
};

export type MlDatasetSplit = {
  trainingRows: number;
  validationRows: number;
  testRows: number;
};

export type MlFeatureImportance = {
  feature: string;
  importance: number;
};

export type MlAdvancedTrainingResult = {
  modelType: string;
  version: string;
  artifactPath: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    classPrecision: Record<string, number>;
    classDistribution: Record<string, number>;
  };
  dataset: MlDatasetSummary;
  split: MlDatasetSplit;
  featureImportance: MlFeatureImportance[];
  trainingTimeSeconds: number;
  notes?: string | null;
};

export type MlModelComparison = {
  timeframe: string;
  models: MlAdvancedTrainingResult[];
  errors: Array<{ modelType: string; message: string }>;
};

export type MlOnlineStatus = {
  modelType: string;
  recordsProcessed: number;
  rollingAccuracy: number;
  lastUpdatedAt?: string | null;
  message?: string;
};

export type MlProcessedRow = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type MlBacktest = {
  pair: string;
  startDate: string;
  endDate: string;
  metrics: {
    initialBalance: number;
    finalBalance: number;
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
    tradeCount: number;
    averageTradeReturn: number;
    bestTrade: number;
    worstTrade: number;
  };
  trades: Array<{
    pair: string;
    entryTime: string;
    exitTime?: string;
    direction: string;
    entryPrice: number;
    exitPrice?: number;
    pnl?: number;
    pnlPercent?: number;
  }>;
  equityCurve: Array<Record<string, unknown>>;
  drawdown: Array<Record<string, unknown>>;
};

export type LiveCandle = {
  pair: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  source: 'MOCK_LIVE' | 'FINNHUB' | 'POLYGON';
};

export type ProviderStatus = {
  provider: string;
  status: string;
  symbol?: string;
  reason?: string;
};