import { Controller, Get, Post, Query } from '@nestjs/common';
import { SignalsService } from './signals.service';

@Controller('signals')
export class SignalsController {
  constructor(private readonly signals: SignalsService) {}

  @Get('latest')
  latest(@Query('pair') pair = 'EURUSD') {
    return this.signals.latest(pair);
  }

  @Get()
  findAll(@Query('pair') pair = 'EURUSD') {
    return this.signals.findAll(pair);
  }

  @Post('generate')
  generate(@Query('pair') pair = 'EURUSD') {
    return this.signals.generate(pair);
  }
}