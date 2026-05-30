import { Activity, BarChart3, Bell, DollarSign, RefreshCw, ShieldAlert, Target } from 'lucide-react';
import { ChartShell } from '../components/ChartShell';
import { EquityCurveChart } from '../components/EquityCurveChart';
import { ErrorState } from '../components/ErrorState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { MetricCard } from '../components/MetricCard';
import { PriceChart } from '../components/PriceChart';
import { SignalBadge } from '../components/SignalBadge';
import { dateTime, money, percent, price } from '../format';
import {
  useAiSummary,
  useAlerts,
  useGenerateSignal,
  useLatestBacktest,
  useLatestSignal,
  useMarketData
} from '../hooks';

export function OverviewPage() {
  const marketData = useMarketData();
  const latestSignal = useLatestSignal();
  const backtest = useLatestBacktest();
  const summary = useAiSummary();
  const alerts = useAlerts();
  const generateSignal = useGenerateSignal();

  if (marketData.isError || latestSignal.isError || backtest.isError) {
    return <ErrorState message="Start PostgreSQL, the FastAPI ML service, and the NestJS API to populate the dashboard." />;
  }

  if (marketData.isLoading || latestSignal.isLoading || backtest.isLoading) {
    return <LoadingState />;
  }

  const signal = latestSignal.data!;
  const run = backtest.data!;
  const recentAlerts = alerts.data?.slice(0, 4) ?? [];
  const equityCurve = run.equityCurve ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={Activity}
          label="Latest signal"
          value={signal.signal}
          detail={`${signal.pair} at ${price(signal.closePrice)}`}
          tone={signal.signal === 'BUY' ? 'good' : signal.signal === 'SELL' ? 'bad' : 'warn'}
        />
        <MetricCard icon={Target} label="Confidence" value={percent(signal.confidence)} detail={dateTime(signal.timestamp)} tone="neutral" />
        <MetricCard
          icon={DollarSign}
          label="Total return"
          value={percent(run.totalReturn, 2)}
          detail={`${money(run.initialBalance)} to ${money(run.finalBalance)}`}
          tone={run.totalReturn >= 0 ? 'good' : 'bad'}
        />
        <MetricCard icon={BarChart3} label="Win rate" value={percent(run.winRate)} detail={`${run.tradeCount} simulated trades`} />
        <MetricCard icon={ShieldAlert} label="Max drawdown" value={percent(run.maxDrawdown)} detail="Peak-to-trough equity" tone="bad" />
        <MetricCard icon={Bell} label="Alerts" value={String(alerts.data?.length ?? 0)} detail="Workflow log entries" tone="warn" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <ChartShell
          title="EUR/USD Price With Model Signals"
          action={
            <IconButton
              icon={RefreshCw}
              label={generateSignal.isPending ? 'Generating' : 'New Signal'}
              onClick={() => generateSignal.mutate()}
              disabled={generateSignal.isPending}
              variant="primary"
            />
          }
        >
          <PriceChart marketData={marketData.data ?? []} equityCurve={equityCurve} />
        </ChartShell>

        <section className="rounded-md border border-line bg-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Latest Signal Context</h2>
            <SignalBadge signal={signal.signal} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-line bg-panelSoft p-3">
              <dt className="text-muted">RSI 14</dt>
              <dd className="mt-1 font-semibold">{signal.rsi?.toFixed(1) ?? 'n/a'}</dd>
            </div>
            <div className="rounded-md border border-line bg-panelSoft p-3">
              <dt className="text-muted">Volatility</dt>
              <dd className="mt-1 font-semibold">{signal.volatility?.toFixed(5) ?? 'n/a'}</dd>
            </div>
            <div className="rounded-md border border-line bg-panelSoft p-3">
              <dt className="text-muted">SMA 10</dt>
              <dd className="mt-1 font-semibold">{price(signal.smaFast)}</dd>
            </div>
            <div className="rounded-md border border-line bg-panelSoft p-3">
              <dt className="text-muted">SMA 30</dt>
              <dd className="mt-1 font-semibold">{price(signal.smaSlow)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-muted">{signal.reason}</p>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <ChartShell title="Simulated Equity Curve">
          <EquityCurveChart data={equityCurve} />
        </ChartShell>

        <section className="rounded-md border border-line bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">AI Market Summary</h2>
          {summary.isLoading ? (
            <p className="text-sm text-muted">Preparing summary...</p>
          ) : (
            <p className="whitespace-pre-line text-sm leading-6 text-muted">{summary.data?.content}</p>
          )}
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent Alerts</h2>
        <div className="divide-y divide-line">
          {recentAlerts.map((alert) => (
            <div key={alert.id} className="grid gap-2 py-3 text-sm md:grid-cols-[140px_100px_1fr_130px]">
              <span className="font-medium">{alert.type}</span>
              <span className="text-muted">{alert.severity}</span>
              <span className="text-muted">{alert.message}</span>
              <span className="text-right text-muted md:text-left">{dateTime(alert.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}