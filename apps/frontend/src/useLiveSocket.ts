import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './api';
import type { Alert, LearningSummary, LiveCandle, LiveState, PaperAccount, PaperPosition, ProviderStatus, Signal, Trade } from './types';

type LiveUiState = {
  connected: boolean;
  providerStatus?: ProviderStatus;
  candles: LiveCandle[];
  signal?: Signal | null;
  account?: PaperAccount;
  positions: PaperPosition[];
  trades: Trade[];
  alerts: Alert[];
  learning?: LearningSummary;
};

export function useLiveSocket(initial?: LiveState) {
  const [state, setState] = useState<LiveUiState>({
    connected: false,
    candles: [],
    positions: [],
    trades: [],
    alerts: []
  });

  useEffect(() => {
    if (!initial) {
      return;
    }

    // REST hydrates reconnects while socket events keep the workspace current between polls.
    setState((current) => ({
      ...current,
      providerStatus:
        current.providerStatus?.provider === initial.provider
          ? current.providerStatus
          : { provider: initial.provider, status: initial.provider === 'FINNHUB' ? 'CONNECTING' : 'CONNECTED' },
      candles: initial.candles.slice(-140),
      signal: initial.signal,
      account: initial.account,
      positions: initial.positions,
      trades: initial.trades,
      alerts: initial.alerts,
      learning: initial.learning
    }));
  }, [initial]);

  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });

    socket.on('connect', () => setState((current) => ({ ...current, connected: true })));
    socket.on('disconnect', () => setState((current) => ({ ...current, connected: false })));

    socket.on('live:provider-status', (providerStatus: ProviderStatus) => {
      setState((current) => ({ ...current, providerStatus }));
    });

    socket.on('live:candle', (candle: LiveCandle) => {
      setState((current) => ({
        ...current,
        candles: [...current.candles, candle].slice(-140)
      }));
    });

    socket.on('live:signal', (signal: Signal) => {
      setState((current) => ({ ...current, signal }));
    });

    socket.on('live:paper-account', (account: PaperAccount) => {
      setState((current) => ({ ...current, account }));
    });

    socket.on('live:position', (position: PaperPosition) => {
      setState((current) => {
        const others = current.positions.filter((item) => item.id !== position.id);
        return { ...current, positions: [position, ...others].sort((a, b) => b.id - a.id) };
      });
    });

    socket.on('live:trade', (trade: Trade) => {
      setState((current) => ({
        ...current,
        trades: [trade, ...current.trades.filter((item) => item.id !== trade.id)].slice(0, 100)
      }));
    });

    socket.on('live:alert', (alert: Alert) => {
      setState((current) => ({
        ...current,
        alerts: [alert, ...current.alerts.filter((item) => item.id !== alert.id)].slice(0, 100)
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const openPosition = useMemo(
    () => state.positions.find((position) => position.status === 'OPEN') ?? null,
    [state.positions]
  );

  return { ...state, openPosition };
}