import { LiveCandle } from '../../types';

export interface LiveMarketDataProvider {
  start(pair: string, onCandle: (candle: LiveCandle) => Promise<void> | void): Promise<void>;
  stop(): Promise<void>;
}