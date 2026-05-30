import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { BacktestsService } from './backtests.service';
import { PrismaService } from './prisma.service';
import { SignalsService } from './signals.service';

@Injectable()
export class AiService {
  constructor(
    private readonly backtests: BacktestsService,
    private readonly prisma: PrismaService,
    private readonly signals: SignalsService
  ) {}

  async latest(pair = 'EURUSD') {
    const latest = await this.prisma.aiSummary.findFirst({
      where: { pair },
      orderBy: { createdAt: 'desc' }
    });

    if (latest) {
      return latest;
    }

    return this.generate(pair);
  }

  async generate(pair = 'EURUSD') {
    const [signal, backtest] = await Promise.all([
      this.signals.latest(pair),
      this.backtests.latest(pair)
    ]);

    const content = process.env.OPENAI_API_KEY
      ? await this.generateWithOpenAi(pair, signal, backtest)
      : this.mockSummary(pair, signal, backtest);

    return this.prisma.aiSummary.create({
      data: {
        pair,
        content,
        source: process.env.OPENAI_API_KEY ? 'OPENAI' : 'MOCK'
      }
    });
  }

  private async generateWithOpenAi(pair: string, signal: any, backtest: any) {
    const prompt = [
      `Pair: ${pair}`,
      `Latest signal: ${signal.signal} at ${(signal.confidence * 100).toFixed(1)}% confidence`,
      `Close price: ${signal.closePrice}`,
      `Backtest total return: ${(backtest.totalReturn * 100).toFixed(2)}%`,
      `Win rate: ${(backtest.winRate * 100).toFixed(1)}%`,
      `Max drawdown: ${(Math.abs(backtest.maxDrawdown) * 100).toFixed(1)}%`,
      'Write a concise market research summary with market condition, model confidence, risk warning, and next analytical steps.',
      'Do not imply this is financial advice or that trades are executed.'
    ].join('\n');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You write careful research summaries for a demo FX analysis dashboard.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20_000
      }
    );

    return response.data.choices?.[0]?.message?.content?.trim() ?? this.mockSummary(pair, signal, backtest);
  }

  private mockSummary(pair: string, signal: any, backtest: any) {
    const confidence = (signal.confidence * 100).toFixed(1);
    const totalReturn = (backtest.totalReturn * 100).toFixed(2);
    const winRate = (backtest.winRate * 100).toFixed(1);
    const drawdown = (Math.abs(backtest.maxDrawdown) * 100).toFixed(1);

    return [
      `${pair} currently shows a ${signal.signal} research signal with ${confidence}% model confidence.`,
      `The latest backtest finished with ${totalReturn}% total return, ${winRate}% win rate, and ${drawdown}% max drawdown across ${backtest.tradeCount} simulated trades.`,
      signal.reason ? `Signal context: ${signal.reason}` : 'Signal context is mixed across the current indicator set.',
      'Risk note: this is a technical research prototype using mock/historical data. It does not execute trades and should not be treated as financial advice.',
      'Next analytical steps: compare the signal against a longer walk-forward test, review drawdown clusters, and test whether confidence thresholds reduce noisy entries.'
    ].join('\n\n');
  }
}