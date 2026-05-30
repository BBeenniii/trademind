import type { SignalValue } from '../types';

const signalStyles: Record<SignalValue, string> = {
  BUY: 'border-buy/40 bg-buy/10 text-buy',
  SELL: 'border-sell/40 bg-sell/10 text-sell',
  HOLD: 'border-hold/40 bg-hold/10 text-hold'
};

export function SignalBadge({ signal }: { signal: SignalValue | string }) {
  const style = signalStyles[signal as SignalValue] ?? 'border-line bg-panelSoft text-muted';

  return (
    <span className={`inline-flex min-w-16 items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold ${style}`}>
      {signal}
    </span>
  );
}