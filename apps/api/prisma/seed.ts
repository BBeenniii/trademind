import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.modelVersion.upsert({
    where: { version: 'v1' },
    update: {},
    create: {
      version: 'v1',
      status: 'CHAMPION',
      modelType: 'RANDOM_FOREST',
      trainingSamples: 0,
      notes: 'Initial demo model'
    }
  });

  const marketDataCount = await prisma.marketData.count();
  if (marketDataCount === 0) {
    await prisma.marketData.createMany({
      data: [
        { pair: 'EURUSD', timestamp: new Date('2024-01-01T00:00:00Z'), open: 1.1028, high: 1.1059, low: 1.1014, close: 1.1041, volume: 1200 },
        { pair: 'EURUSD', timestamp: new Date('2024-01-01T04:00:00Z'), open: 1.1041, high: 1.1064, low: 1.1022, close: 1.1035, volume: 1380 },
        { pair: 'EURUSD', timestamp: new Date('2024-01-01T08:00:00Z'), open: 1.1035, high: 1.1071, low: 1.1029, close: 1.1062, volume: 1510 },
        { pair: 'EURUSD', timestamp: new Date('2024-01-01T12:00:00Z'), open: 1.1062, high: 1.1084, low: 1.1048, close: 1.1076, volume: 1325 },
        { pair: 'EURUSD', timestamp: new Date('2024-01-01T16:00:00Z'), open: 1.1076, high: 1.1082, low: 1.1037, close: 1.1046, volume: 1700 }
      ]
    });
  }

  const alertCount = await prisma.alert.count();
  if (alertCount === 0) {
    await prisma.alert.create({
      data: {
        type: 'SYSTEM',
        severity: 'LOW',
        message: 'Demo database seeded. Generate a signal to start the research workflow.'
      }
    });
  }

  const summaryCount = await prisma.aiSummary.count();
  if (summaryCount === 0) {
    await prisma.aiSummary.create({
      data: {
        pair: 'EURUSD',
        source: 'MOCK',
        content:
          'TradeMind AI is ready for a demo run. Generate a fresh signal and backtest to populate the dashboard with current research metrics.'
      }
    });
  }

  const paperAccountCount = await prisma.paperAccount.count({ where: { isActive: true } });
  if (paperAccountCount === 0) {
    await prisma.paperAccount.create({
      data: {
        startingBalance: 10000,
        cashBalance: 10000,
        equity: 10000
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });