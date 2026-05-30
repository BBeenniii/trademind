import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ModelLifecycleService } from './model-lifecycle.service';

@Controller('models')
export class ModelLifecycleController {
  constructor(private readonly lifecycle: ModelLifecycleService) {}

  @Get()
  models() {
    return this.lifecycle.listModels();
  }

  @Get('champion')
  champion() {
    return this.lifecycle.ensureChampion();
  }

  @Get('performance')
  performance() {
    return this.lifecycle.getPerformance();
  }

  @Get('summary')
  summary() {
    return this.lifecycle.getLearningSummary();
  }

  @Get('feedback')
  feedback() {
    return this.lifecycle.getFeedbackRecords();
  }

  @Get('training-runs')
  trainingRuns() {
    return this.lifecycle.getTrainingRuns();
  }

  @Post('retrain')
  retrain() {
    return this.lifecycle.retrain();
  }

  @Post('train')
  train(@Body() body: { modelType?: string; timeframe?: string }) {
    return this.lifecycle.trainModel(body.modelType, body.timeframe);
  }

  @Post('compare')
  compare(@Body() body: { timeframe?: string; includeXgboost?: boolean }) {
    return this.lifecycle.compareModels(body.timeframe, body.includeXgboost);
  }

  @Get('online/status')
  onlineStatus() {
    return this.lifecycle.onlineStatus();
  }

  @Post('online/update')
  onlineUpdate() {
    return this.lifecycle.updateOnlineLearner();
  }

  @Get(':id/feature-importance')
  featureImportance(@Param('id', ParseIntPipe) id: number) {
    return this.lifecycle.getFeatureImportance(id);
  }

  @Post(':id/promote')
  promote(@Param('id', ParseIntPipe) id: number) {
    return this.lifecycle.promote(id);
  }
}