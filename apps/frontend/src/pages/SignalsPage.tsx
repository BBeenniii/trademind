import { RefreshCw } from 'lucide-react';
import { ErrorState } from '../components/ErrorState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { SignalBadge } from '../components/SignalBadge';
import { dateTime, percent, price } from '../format';
import { useGenerateSignal, useSignals } from '../hooks';

export function SignalsPage() {
  const signals = useSignals();
  const generateSignal = useGenerateSignal();

  if (signals.isError) {
    return <ErrorState />;
  }

  if (signals.isLoading) {
    return <LoadingState label="Loading signal history" />;
  }

  return (
    <section className="rounded-md border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div>
          <h1 className="text-base font-semibold">Signal History</h1>
          <p className="text-sm text-muted">Generated BUY / SELL / HOLD decisions from the ML service</p>
        </div>
        <IconButton
          icon={RefreshCw}
          label={generateSignal.isPending ? 'Generating' : 'Generate Signal'}
          onClick={() => generateSignal.mutate()}
          disabled={generateSignal.isPending}
          variant="primary"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Pair</th>
              <th className="px-4 py-3">Signal</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Close</th>
              <th className="px-4 py-3">Indicator Snapshot</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(signals.data ?? []).map((signal) => (
              <tr key={signal.id} className="align-top">
                <td className="px-4 py-3 text-muted">{dateTime(signal.timestamp)}</td>
                <td className="px-4 py-3 font-medium">{signal.pair}</td>
                <td className="px-4 py-3"><SignalBadge signal={signal.signal} /></td>
                <td className="px-4 py-3">{percent(signal.confidence)}</td>
                <td className="px-4 py-3">{price(signal.closePrice)}</td>
                <td className="px-4 py-3 text-muted">
                  RSI {signal.rsi?.toFixed(1) ?? 'n/a'} / SMA {price(signal.smaFast)} - {price(signal.smaSlow)}
                </td>
                <td className="max-w-md px-4 py-3 text-muted">{signal.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}