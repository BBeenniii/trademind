import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { LiveCandle, ProviderStatus } from '../types';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://127.0.0.1:5173'
  }
})
export class LiveMarketGateway {
  @WebSocketServer()
  private server?: Server;

  emitCandle(candle: LiveCandle) {
    this.server?.emit('live:candle', serializeCandle(candle));
  }

  emitSignal(signal: unknown) {
    this.server?.emit('live:signal', signal);
  }

  emitPaperAccount(account: unknown) {
    this.server?.emit('live:paper-account', account);
  }

  emitPosition(position: unknown) {
    this.server?.emit('live:position', position);
  }

  emitTrade(trade: unknown) {
    this.server?.emit('live:trade', trade);
  }

  emitAlert(alert: unknown) {
    this.server?.emit('live:alert', alert);
  }

  emitProviderStatus(status: ProviderStatus) {
    this.server?.emit('live:provider-status', status);
  }
}

function serializeCandle(candle: LiveCandle) {
  return {
    ...candle,
    timestamp: candle.timestamp.toISOString()
  };
}