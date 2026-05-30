import { Controller, Get, Post } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  findAll() {
    return this.alerts.findAll();
  }

  @Post('test')
  test() {
    return this.alerts.testAlert();
  }
}