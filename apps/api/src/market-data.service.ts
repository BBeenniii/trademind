import { Injectable } from '@nestjs/common';
import { MlService } from './ml.service';
import { PrismaService } from './prisma.service';

@Injectable()
export class MarketDataService {
  constructor(
    private readonly ml: MlService,
    private readonly prisma: PrismaService
  ) {}

  async findAll(pair = 'EURUSD') {
    let rows = await this.prisma.marketData.findMany({
      where: { pair },
      orderBy: { timestamp: 'asc' },
      take: 260
    });

    if (rows.length === 0) {
      await this.importFromMl(pair);
      rows = await this.prisma.marketData.findMany({
        where: { pair },
        orderBy: { timestamp: 'asc' },
        take: 260
      });
    }

    return rows;
  }

  async importFromMl(pair = 'EURUSD') {
    const processed = await this.ml.process(pair);
    await this.prisma.marketData.deleteMany({ where: { pair } });
    await this.prisma.marketData.createMany({
      data: processed.rows.map((row) => ({
        pair,
        timestamp: new Date(row.timestamp),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: row.volume === undefined ? null : Number(row.volume)
      }))
    });

    return { imported: processed.rows.length, pair };
  }
}