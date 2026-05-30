import { Controller, Get, Post } from '@nestjs/common';
import { ModelLifecycleService } from './model-lifecycle.service';

@Controller('dataset')
export class DatasetController {
  constructor(private readonly lifecycle: ModelLifecycleService) {}

  @Get('status')
  status() {
    return this.lifecycle.datasetStatus();
  }

  @Get('metadata')
  metadata() {
    return this.lifecycle.datasetMetadata();
  }

  @Post('process')
  process() {
    return this.lifecycle.processDataset();
  }
}