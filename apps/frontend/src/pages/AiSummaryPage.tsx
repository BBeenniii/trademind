import { Brain, RefreshCw } from 'lucide-react';
import { ErrorState } from '../components/ErrorState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { dateTime } from '../format';
import { useAiSummary, useGenerateSummary, useLatestBacktest, useLatestSignal } from '../hooks';

export function AiSummaryPage() {
  const summary = useAiSummary();
  const signal = useLatestSignal();
  const backtest = useLatestBacktest();
  const generate = useGenerateSummary();

  if (summary.isError) {
    return <ErrorState />;
  }

  if (summary.isLoading) {
    return <LoadingState label="Loading AI summary" />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="rounded-md border border-line bg-panel p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-buy/40 bg-buy/10 p-2 text-buy">
              <Brain size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold">AI Market Summary</h1>
              <p className="text-sm text-muted">
                {summary.data?.source} summary generated {dateTime(summary.data?.createdAt)}
              </p>
            </div>
          </div>
          <IconButton
            icon={RefreshCw}
            label={generate.isPending ? 'Generating' : 'Generate New Summary'}
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            variant="primary"
          />
        </div>
        <article className="max-w-3xl whitespace-pre-line text-sm leading-7 text-ink">{summary.data?.content}</article>
      </section>

      <aside className="space-y-4">
        <section className="rounded-md border border-line bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Latest Signal</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Signal</dt>
              <dd>{signal.data?.signal ?? 'n/a'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Confidence</dt>
              <dd>{signal.data ? `${(signal.data.confidence * 100).toFixed(1)}%` : 'n/a'}</dd>
            </div>
            <div className="text-muted">{signal.data?.reason}</div>
          </dl>
        </section>
        <section className="rounded-md border border-line bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Risk Notes</h2>
          <p className="text-sm leading-6 text-muted">
            Drawdown is currently {backtest.data ? `${Math.abs(backtest.data.maxDrawdown * 100).toFixed(1)}%` : 'n/a'} in the simulated backtest.
            The result is useful for workflow testing, not real-money decision making.
          </p>
        </section>
      </aside>
    </div>
  );
}