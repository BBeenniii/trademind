import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from './prisma.service';

type AlertInput = {
  type: string;
  severity: string;
  message: string;
};

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.alert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async create(input: AlertInput) {
    const alert = await this.prisma.alert.create({ data: input });
    console.log(`[${alert.severity}] ${alert.type}: ${alert.message}`);
    await this.sendDiscordAlert(alert.message);
    return alert;
  }

  async testAlert() {
    return this.create({
      type: 'TEST',
      severity: 'LOW',
      message: 'Manual workflow alert generated from the API.'
    });
  }

  private async sendDiscordAlert(message: string) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    try {
      await axios.post(webhookUrl, { content: `TradeMind AI: ${message}` });
    } catch {
      console.warn('Discord webhook failed; alert was still saved to the database.');
    }
  }
}