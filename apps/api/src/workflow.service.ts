import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertsService } from './alerts.service';
import { BacktestsService } from './backtests.service';
import { SignalsService } from './signals.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly alerts: AlertsService,
    private readonly backtests: BacktestsService,
    private readonly signals: SignalsService
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async generateSignalSnapshot() {
    // Scheduled snapshots support research history only they never submit orders.
    await this.signals.generate('EURUSD');
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async dailyResearchRun() {
    await this.backtests.run('EURUSD');
    await this.alerts.create({
      type: 'REPORT',
      severity: 'LOW',
      message: 'Daily EURUSD research report generated.'
    });
  }
}