import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { LiveMarketService } from './live-market.service';

@Controller('live')
export class LiveMarketController {
  constructor(private readonly liveMarket: LiveMarketService) {}

  @Get('state')
  state() {
    return this.liveMarket.latestState();
  }

  @Post('provider')
  provider(@Body('provider') provider: string) {
    const normalized = provider?.toLowerCase();
    if (normalized !== 'mock' && normalized !== 'finnhub') {
      throw new BadRequestException('Provider must be "mock" or "finnhub".');
    }

    return this.liveMarket.switchProvider(normalized);
  }
}