import { WebSocket } from 'ws';
import { LiveCandle } from '../../types';
import { LiveMarketDataProvider } from './market-data-provider.interface';

type TickBucket = {
  windowStart: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export class FinnhubLiveMarketProvider implements LiveMarketDataProvider {
  private socket?: WebSocket;
  private bucket?: TickBucket;
  private fallbackTimer?: NodeJS.Timeout;
  private reconnects = 0;

  constructor(
    private readonly token: string,
    private readonly symbol: string,
    private readonly onFallback: (reason: string) => void
  ) {}

  async start(pair: string, onCandle: (candle: LiveCandle) => Promise<void> | void) {
    await this.stop();
    this.connect(pair, onCandle);
  }

  async stop() {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = undefined;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = undefined;
    }
  }

  private connect(pair: string, onCandle: (candle: LiveCandle) => Promise<void> | void) {
    const socket = new WebSocket(`wss://ws.finnhub.io?token=${this.token}`);
    this.socket = socket;

    // Some Finnhub plans connect successfully but do not publish this FX symbol.
    this.fallbackTimer = setTimeout(() => {
      this.onFallback(
        'Finnhub connected but did not stream usable EUR/USD ticks within 15 seconds. FX may be closed or the symbol may not be available on this API plan; using mock-live mode.'
      );
    }, 15_000);

    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'subscribe', symbol: this.symbol }));
    });

    socket.on('message', (raw) => {
      let message: any;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (message.type !== 'trade' || !Array.isArray(message.data)) {
        return;
      }

      for (const tick of message.data) {
        const price = Number(tick.p);
        const timestamp = Number(tick.t);
        if (!Number.isFinite(price) || !Number.isFinite(timestamp)) {
          continue;
        }

        if (this.fallbackTimer) {
          clearTimeout(this.fallbackTimer);
          this.fallbackTimer = undefined;
        }

        const candle = this.consumeTick(pair, price, timestamp, Number(tick.v ?? 0));
        if (candle) {
          onCandle(candle);
        }
      }
    });

    socket.on('close', () => {
      if (this.reconnects < 2) {
        this.reconnects += 1;
        setTimeout(() => this.connect(pair, onCandle), 2_000);
        return;
      }

      this.onFallback('Finnhub WebSocket closed repeatedly.');
    });

    socket.on('error', () => {
      if (this.reconnects >= 2) {
        this.onFallback('Finnhub WebSocket connection failed.');
      }
    });
  }

  private consumeTick(pair: string, price: number, timestamp: number, volume: number): LiveCandle | undefined {
    // The UI consumes compact two-second OHLCV candles rather than every provider tick.
    const windowMs = 2_000;
    const windowStart = Math.floor(timestamp / windowMs) * windowMs;

    if (!this.bucket || this.bucket.windowStart !== windowStart) {
      const previous = this.bucket;
      this.bucket = {
        windowStart,
        open: price,
        high: price,
        low: price,
        close: price,
        volume
      };

      if (previous) {
        return {
          pair,
          timestamp: new Date(previous.windowStart),
          open: previous.open,
          high: previous.high,
          low: previous.low,
          close: previous.close,
          volume: previous.volume,
          source: 'FINNHUB'
        };
      }

      return undefined;
    }

    this.bucket.high = Math.max(this.bucket.high, price);
    this.bucket.low = Math.min(this.bucket.low, price);
    this.bucket.close = price;
    this.bucket.volume += volume || 0;
    return undefined;
  }
}