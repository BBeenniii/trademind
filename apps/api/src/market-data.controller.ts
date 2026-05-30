import { Controller, Get, Post, Query } from '@nestjs/common';
import { MarketDataService } from './market-data.service';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get()
  findAll(@Query('pair') pair = 'EURUSD') {
    return this.marketData.findAll(pair);
  }

  @Post('import')
  importData(@Query('pair') pair = 'EURUSD') {
    return this.marketData.importFromMl(pair);
  }
}