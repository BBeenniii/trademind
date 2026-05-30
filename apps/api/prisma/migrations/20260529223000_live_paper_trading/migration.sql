ALTER TABLE "MarketData" ADD COLUMN "source" TEXT;
ALTER TABLE "Signal" ADD COLUMN "source" TEXT;

ALTER TABLE "Trade" ALTER COLUMN "backtestRunId" DROP NOT NULL;
ALTER TABLE "Trade" ADD COLUMN "paperAccountId" INTEGER;
ALTER TABLE "Trade" ADD COLUMN "size" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN "closeReason" TEXT;
ALTER TABLE "Trade" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'BACKTEST';

CREATE TABLE "PaperAccount" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Demo Paper Account',
  "startingBalance" DOUBLE PRECISION NOT NULL,
  "cashBalance" DOUBLE PRECISION NOT NULL,
  "equity" DOUBLE PRECISION NOT NULL,
  "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unrealizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaperAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperPosition" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "pair" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "entryTime" TIMESTAMP(3) NOT NULL,
  "entryPrice" DOUBLE PRECISION NOT NULL,
  "size" DOUBLE PRECISION NOT NULL,
  "stopLoss" DOUBLE PRECISION,
  "takeProfit" DOUBLE PRECISION,
  "currentPrice" DOUBLE PRECISION,
  "unrealizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "exitTime" TIMESTAMP(3),
  "exitPrice" DOUBLE PRECISION,
  "realizedPnl" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaperPosition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaperPosition_pair_status_idx" ON "PaperPosition"("pair", "status");

ALTER TABLE "Trade"
  ADD CONSTRAINT "Trade_paperAccountId_fkey"
  FOREIGN KEY ("paperAccountId") REFERENCES "PaperAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaperPosition"
  ADD CONSTRAINT "PaperPosition_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;