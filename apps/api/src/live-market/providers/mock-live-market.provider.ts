import { LiveCandle } from '../../types';
import { LiveMarketDataProvider } from './market-data-provider.interface';

export class MockLiveMarketProvider implements LiveMarketDataProvider {
  private timer?: NodeJS.Timeout;
  private lastClose = 1.085;

  async start(pair: string, onCandle: (candle: LiveCandle) => Promise<void> | void) {
    // Mock-live makes the workflow demonstrable on weekends and without external credentials.
    await this.stop();

    this.timer = setInterval(() => {
      const open = this.lastClose;
      const move = (Math.random() - 0.5) * 0.0008;
      const close = Math.max(0.9, open + move);
      const high = Math.max(open, close) + Math.random() * 0.00025;
      const low = Math.min(open, close) - Math.random() * 0.00025;
      this.lastClose = close;

      onCandle({
        pair,
        timestamp: new Date(),
        open: round(open),
        high: round(high),
        low: round(low),
        close: round(close),
        volume: Math.round(900 + Math.random() * 2600),
        source: 'MOCK_LIVE'
      });
    }, 2_000);
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

function round(value: number) {
  return Number(value.toFixed(5));
}