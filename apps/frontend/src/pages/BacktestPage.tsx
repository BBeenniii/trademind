import { Play } from 'lucide-react';
import { ChartShell } from '../components/ChartShell';
import { DrawdownChart, EquityCurveChart } from '../components/EquityCurveChart';
import { ErrorState } from '../components/ErrorState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { MetricCard } from '../components/MetricCard';
import { dateTime, money, percent, price } from '../format';
import { useLatestBacktest, useRunBacktest } from '../hooks';
import { BarChart3, DollarSign, Percent, ShieldAlert, Target } from 'lucide-react';

export function BacktestPage() {
  const backtest = useLatestBacktest();
  const runBacktest = useRunBacktest();

  if (backtest.isError) {
    return <ErrorState />;
  }

  if (backtest.isLoading) {
    return <LoadingState label="Loading backtest results" />;
  }

  const run = backtest.data!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">Backtest</h1>
          <p className="text-sm text-muted">Simple simulated workflow using model-generated signals</p>
        </div>
        <IconButton
          icon={Play}
          label={runBacktest.isPending ? 'Running' : 'Run Backtest'}
          onClick={() => runBacktest.mutate()}
          disabled={runBacktest.isPending}
          variant="primary"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={DollarSign} label="Final balance" value={money(run.finalBalance)} detail={`Started at ${money(run.initialBalance)}`} />
        <MetricCard icon={Percent} label="Total return" value={percent(run.totalReturn, 2)} tone={run.totalReturn >= 0 ? 'good' : 'bad'} />
        <MetricCard icon={Target} label="Win rate" value={percent(run.winRate)} detail={`${run.tradeCount} trades`} />
        <MetricCard icon={ShieldAlert} label="Max drawdown" value={percent(run.maxDrawdown)} tone="bad" />
        <MetricCard icon={BarChart3} label="Avg trade" value={percent(run.averageTradeReturn ?? 0, 2)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartShell title="Equity Curve">
          <EquityCurveChart data={run.equityCurve ?? []} />
        </ChartShell>
        <ChartShell title="Drawdown">
          <DrawdownChart data={run.drawdownCurve ?? []} />
        </ChartShell>
      </div>

      <section className="rounded-md border border-line bg-panel">
        <div className="border-b border-line p-4">
          <h2 className="text-sm font-semibold">Simulated Trades</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Entry</th>
                <th className="px-4 py-3">Exit</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Entry Price</th>
                <th className="px-4 py-3">Exit Price</th>
                <th className="px-4 py-3">P/L</th>
                <th className="px-4 py-3">P/L %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {run.trades.map((trade) => (
                <tr key={trade.id}>
                  <td className="px-4 py-3 text-muted">{dateTime(trade.entryTime)}</td>
                  <td className="px-4 py-3 text-muted">{dateTime(trade.exitTime)}</td>
                  <td className="px-4 py-3 font-medium">{trade.direction}</td>
                  <td className="px-4 py-3">{price(trade.entryPrice)}</td>
                  <td className="px-4 py-3">{price(trade.exitPrice)}</td>
                  <td className={`px-4 py-3 ${(trade.pnl ?? 0) >= 0 ? 'text-buy' : 'text-sell'}`}>{money(trade.pnl)}</td>
                  <td className={`px-4 py-3 ${(trade.pnlPercent ?? 0) >= 0 ? 'text-buy' : 'text-sell'}`}>{percent(trade.pnlPercent, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}