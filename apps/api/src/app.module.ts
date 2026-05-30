import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { BacktestsController } from './backtests.controller';
import { BacktestsService } from './backtests.service';
import { HealthController } from './health.controller';
import { LiveMarketController } from './live-market/live-market.controller';
import { LiveMarketGateway } from './live-market/live-market.gateway';
import { LiveMarketService } from './live-market/live-market.service';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { MlService } from './ml.service';
import { ModelFeedbackService } from './model-feedback/model-feedback.service';
import { DatasetController } from './model-lifecycle/dataset.controller';
import { ModelLifecycleController } from './model-lifecycle/model-lifecycle.controller';
import { ModelLifecycleService } from './model-lifecycle/model-lifecycle.service';
import { PaperTradingController } from './paper-trading/paper-trading.controller';
import { PaperTradingService } from './paper-trading/paper-trading.service';
import { PrismaService } from './prisma.service';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env']
    }),
    ScheduleModule.forRoot()
  ],
  controllers: [
    AiController,
    AlertsController,
    BacktestsController,
    DatasetController,
    HealthController,
    LiveMarketController,
    MarketDataController,
    ModelLifecycleController,
    PaperTradingController,
    SignalsController
  ],
  providers: [
    AiService,
    AlertsService,
    BacktestsService,
    LiveMarketGateway,
    LiveMarketService,
    MarketDataService,
    MlService,
    ModelFeedbackService,
    ModelLifecycleService,
    PaperTradingService,
    PrismaService,
    SignalsService,
    WorkflowService
  ]
})
export class AppModule {}