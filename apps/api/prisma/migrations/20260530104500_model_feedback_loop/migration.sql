-- AlterTable
ALTER TABLE "Signal"
ADD COLUMN "modelVersionId" INTEGER,
ADD COLUMN "momentum" DOUBLE PRECISION,
ADD COLUMN "returnPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Trade"
ADD COLUMN "signalId" INTEGER;

-- AlterTable
ALTER TABLE "PaperPosition"
ADD COLUMN "signalId" INTEGER;

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainedUntil" TIMESTAMP(3),
    "trainingSamples" INTEGER NOT NULL,
    "validationSamples" INTEGER,
    "accuracy" DOUBLE PRECISION,
    "precision" DOUBLE PRECISION,
    "recall" DOUBLE PRECISION,
    "f1Score" DOUBLE PRECISION,
    "winRate" DOUBLE PRECISION,
    "avgPnl" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "profitFactor" DOUBLE PRECISION,
    "notes" TEXT,
    "artifactPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackRecord" (
    "id" SERIAL NOT NULL,
    "signalId" INTEGER,
    "modelVersionId" INTEGER,
    "tradeId" INTEGER,
    "pair" TEXT NOT NULL,
    "signalValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "closePrice" DOUBLE PRECISION NOT NULL,
    "rsi" DOUBLE PRECISION,
    "smaFast" DOUBLE PRECISION,
    "smaSlow" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "momentum" DOUBLE PRECISION,
    "returnPct" DOUBLE PRECISION,
    "outcome" TEXT NOT NULL,
    "pnl" DOUBLE PRECISION,
    "pnlPercent" DOUBLE PRECISION,
    "holdingSeconds" INTEGER,
    "maxFavorableMove" DOUBLE PRECISION,
    "maxAdverseMove" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelTrainingRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "samplesUsed" INTEGER,
    "previousChampionId" INTEGER,
    "challengerVersion" TEXT,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "metricsJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelTrainingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_version_key" ON "ModelVersion"("version");

-- CreateIndex
CREATE INDEX "Signal_modelVersionId_idx" ON "Signal"("modelVersionId");

-- CreateIndex
CREATE INDEX "Trade_signalId_idx" ON "Trade"("signalId");

-- CreateIndex
CREATE INDEX "PaperPosition_signalId_idx" ON "PaperPosition"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackRecord_tradeId_key" ON "FeedbackRecord"("tradeId");

-- CreateIndex
CREATE INDEX "FeedbackRecord_pair_createdAt_idx" ON "FeedbackRecord"("pair", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackRecord_modelVersionId_idx" ON "FeedbackRecord"("modelVersionId");

-- CreateIndex
CREATE INDEX "FeedbackRecord_outcome_idx" ON "FeedbackRecord"("outcome");

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperPosition" ADD CONSTRAINT "PaperPosition_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecord" ADD CONSTRAINT "FeedbackRecord_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecord" ADD CONSTRAINT "FeedbackRecord_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecord" ADD CONSTRAINT "FeedbackRecord_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;