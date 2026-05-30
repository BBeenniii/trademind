-- AlterTable
ALTER TABLE "ModelVersion"
ADD COLUMN "datasetSource" TEXT,
ADD COLUMN "timeframe" TEXT,
ADD COLUMN "trainingRows" INTEGER,
ADD COLUMN "validationRows" INTEGER,
ADD COLUMN "testRows" INTEGER,
ADD COLUMN "featureImportance" JSONB,
ADD COLUMN "classDistribution" JSONB,
ADD COLUMN "trainingTimeSecs" DOUBLE PRECISION;