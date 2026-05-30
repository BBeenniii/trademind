import { Controller, Get, Post, Query } from '@nestjs/common';
import { BacktestsService } from './backtests.service';

@Controller('backtests')
export class BacktestsController {
  constructor(private readonly backtests: BacktestsService) {}

  @Get('latest')
  latest(@Query('pair') pair = 'EURUSD') {
    return this.backtests.latest(pair);
  }

  @Post('run')
  run(@Query('pair') pair = 'EURUSD') {
    return this.backtests.run(pair);
  }
}