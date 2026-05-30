export type SignalValue = 'BUY' | 'SELL' | 'HOLD';

export type Signal = {
  id: number;
  pair: string;
  timestamp: string;
  signal: SignalValue;
  confidence: number;
  closePrice: number;
  rsi?: number | null;
  smaFast?: number | null;
  smaSlow?: number | null;
  volatility?: number | null;
  momentum?: number | null;
  returnPct?: number | null;
  reason?: string | null;
  source?: string | null;
  modelVersionId?: number | null;
  modelVersion?: { version: string } | null;
  createdAt: string;
};

export type MarketData = {
  id: number;
  pair: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  source?: string | null;
};

export type EquityPoint = {
  timestamp: string;
  equity: number;
  close: number;
  signal: SignalValue;
  confidence: number;
};

export type DrawdownPoint = {
  timestamp: string;
  drawdown: number;
};

export type Trade = {
  id: number;
  backtestRunId?: number | null;
  paperAccountId?: number | null;
  signalId?: number | null;
  signal?: Signal | null;
  pair: string;
  entryTime: string;
  exitTime?: string | null;
  direction: string;
  entryPrice: number;
  exitPrice?: number | null;
  size?: number | null;
  pnl?: number | null;
  pnlPercent?: number | null;
  closeReason?: string | null;
  mode?: string;
};

export type BacktestRun = {
  id: number;
  pair: string;
  startDate?: string | null;
  endDate?: string | null;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  tradeCount: number;
  averageTradeReturn?: number | null;
  bestTrade?: number | null;
  worstTrade?: number | null;
  equityCurve?: EquityPoint[];
  drawdownCurve?: DrawdownPoint[];
  trades: Trade[];
  createdAt: string;
};

export type AiSummary = {
  id: number;
  pair: string;
  content: string;
  source: 'OPENAI' | 'MOCK';
  createdAt: string;
};

export type Alert = {
  id: number;
  type: string;
  severity: string;
  message: string;
  status: string;
  createdAt: string;
};

export type LiveCandle = {
  pair: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  source: 'MOCK_LIVE' | 'FINNHUB' | 'POLYGON';
};

export type PaperAccount = {
  id: number;
  name: string;
  startingBalance: number;
  cashBalance: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaperPosition = {
  id: number;
  accountId: number;
  signalId?: number | null;
  pair: string;
  direction: 'LONG' | 'SHORT';
  entryTime: string;
  entryPrice: number;
  size: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  currentPrice?: number | null;
  unrealizedPnl: number;
  status: 'OPEN' | 'CLOSED';
  exitTime?: string | null;
  exitPrice?: number | null;
  realizedPnl?: number | null;
};

export type ProviderStatus = {
  provider: string;
  status: string;
  symbol?: string;
  reason?: string;
};

export type LiveProviderMode = 'mock' | 'finnhub';

export type LearningSummary = {
  active: boolean;
  currentModel: string;
  currentModelType?: string;
  datasetSource?: string;
  feedbackCount: number;
  newFeedbackCount: number;
  retrainMinFeedback: number;
  retrainRecommended: boolean;
  recentWinRate: number;
  lastOutcome?: string | null;
};

export type LiveState = {
  provider: string;
  candles: LiveCandle[];
  signal?: Signal | null;
  account: PaperAccount;
  positions: PaperPosition[];
  trades: Trade[];
  alerts: Alert[];
  learning: LearningSummary;
};

export type ModelVersion = {
  id: number;
  version: string;
  status: 'CHAMPION' | 'CHALLENGER' | 'ARCHIVED';
  modelType: string;
  trainedAt: string;
  trainingSamples: number;
  validationSamples?: number | null;
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1Score?: number | null;
  winRate?: number | null;
  avgPnl?: number | null;
  maxDrawdown?: number | null;
  profitFactor?: number | null;
  notes?: string | null;
  artifactPath?: string | null;
  datasetSource?: string | null;
  timeframe?: string | null;
  trainingRows?: number | null;
  validationRows?: number | null;
  testRows?: number | null;
  featureImportance?: FeatureImportance[] | null;
  classDistribution?: Record<string, number> | null;
  trainingTimeSecs?: number | null;
  _count?: {
    signals: number;
    feedbackRecords: number;
  };
};

export type ModelPerformance = {
  id: number;
  version: string;
  status: ModelVersion['status'];
  modelType: string;
  trainedAt: string;
  accuracy?: number | null;
  signalCount: number;
  feedbackCount: number;
  winRate: number;
  lossRate: number;
  avgPnl: number;
  avgConfidence: number;
  highConfidenceWinRate: number;
  recentWinRate: number;
  recentAvgPnl: number;
};

export type FeedbackRecord = {
  id: number;
  pair: string;
  signalValue: SignalValue;
  confidence: number;
  outcome: string;
  pnl?: number | null;
  pnlPercent?: number | null;
  holdingSeconds?: number | null;
  createdAt: string;
  modelVersion?: { version: string } | null;
};

export type ModelTrainingRun = {
  id: number;
  startedAt: string;
  finishedAt?: string | null;
  status: string;
  trigger: string;
  samplesUsed?: number | null;
  challengerVersion?: string | null;
  promoted: boolean;
  errorMessage?: string | null;
};

export type DatasetMetadata = {
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

export type DatasetStatus = {
  rawDatasetDetected: boolean;
  processedDatasetExists: boolean;
  activeSource: string;
  rawFileCount: number;
  availableTimeframes: string[];
  metadata?: DatasetMetadata | null;
};

export type FeatureImportance = {
  feature: string;
  importance: number;
};

export type AdvancedTrainingResult = {
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
  dataset: {
    source: string;
    timeframe: string;
    rowCount: number;
    startDate: string;
    endDate: string;
  };
  split: {
    trainingRows: number;
    validationRows: number;
    testRows: number;
  };
  featureImportance: FeatureImportance[];
  trainingTimeSeconds: number;
  notes?: string | null;
};

export type ModelComparison = {
  timeframe: string;
  models: AdvancedTrainingResult[];
  errors: Array<{ modelType: string; message: string }>;
};

export type OnlineLearningStatus = {
  modelType: string;
  recordsProcessed: number;
  rollingAccuracy: number;
  lastUpdatedAt?: string | null;
  message?: string;
};