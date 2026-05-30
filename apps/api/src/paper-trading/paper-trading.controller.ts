import { Controller, Get, Post } from '@nestjs/common';
import { PaperTradingService } from './paper-trading.service';

@Controller('paper')
export class PaperTradingController {
  constructor(private readonly paper: PaperTradingService) {}

  @Get('account')
  account() {
    return this.paper.getAccount();
  }

  @Get('positions')
  positions() {
    return this.paper.getPositions();
  }

  @Get('trades')
  trades() {
    return this.paper.getTrades();
  }

  @Post('reset')
  reset() {
    return this.paper.reset();
  }
}