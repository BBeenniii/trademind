CREATE TABLE "MarketData" (
  "id" SERIAL NOT NULL,
  "pair" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "open" DOUBLE PRECISION NOT NULL,
  "high" DOUBLE PRECISION NOT NULL,
  "low" DOUBLE PRECISION NOT NULL,
  "close" DOUBLE PRECISION NOT NULL,
  "volume" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketData_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Signal" (
  "id" SERIAL NOT NULL,
  "pair" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "signal" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "closePrice" DOUBLE PRECISION NOT NULL,
  "rsi" DOUBLE PRECISION,
  "smaFast" DOUBLE PRECISION,
  "smaSlow" DOUBLE PRECISION,
  "volatility" DOUBLE PRECISION,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BacktestRun" (
  "id" SERIAL NOT NULL,
  "pair" TEXT NOT NULL,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "initialBalance" DOUBLE PRECISION NOT NULL,
  "finalBalance" DOUBLE PRECISION NOT NULL,
  "totalReturn" DOUBLE PRECISION NOT NULL,
  "winRate" DOUBLE PRECISION NOT NULL,
  "maxDrawdown" DOUBLE PRECISION NOT NULL,
  "tradeCount" INTEGER NOT NULL,
  "averageTradeReturn" DOUBLE PRECISION,
  "bestTrade" DOUBLE PRECISION,
  "worstTrade" DOUBLE PRECISION,
  "equityCurve" JSONB,
  "drawdownCurve" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trade" (
  "id" SERIAL NOT NULL,
  "backtestRunId" INTEGER NOT NULL,
  "pair" TEXT NOT NULL,
  "entryTime" TIMESTAMP(3) NOT NULL,
  "exitTime" TIMESTAMP(3),
  "direction" TEXT NOT NULL,
  "entryPrice" DOUBLE PRECISION NOT NULL,
  "exitPrice" DOUBLE PRECISION,
  "pnl" DOUBLE PRECISION,
  "pnlPercent" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Alert" (
  "id" SERIAL NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSummary" (
  "id" SERIAL NOT NULL,
  "pair" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiSummary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketData_pair_timestamp_idx" ON "MarketData"("pair", "timestamp");
CREATE INDEX "Signal_pair_timestamp_idx" ON "Signal"("pair", "timestamp");

ALTER TABLE "Trade"
  ADD CONSTRAINT "Trade_backtestRunId_fkey"
  FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;