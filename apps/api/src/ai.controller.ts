import { Controller, Get, Post, Query } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('summary')
  latest(@Query('pair') pair = 'EURUSD') {
    return this.ai.latest(pair);
  }

  @Post('summary/generate')
  generate(@Query('pair') pair = 'EURUSD') {
    return this.ai.generate(pair);
  }
}