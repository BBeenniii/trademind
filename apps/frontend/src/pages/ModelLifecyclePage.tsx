import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, Cpu, Database, GitCompare, Play, RefreshCw, RotateCcw, ShieldAlert, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState } from '../components/ErrorState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { dateTime, percent } from '../format';
import {
  useAlerts,
  useChampionModel,
  useCompareModels,
  useDatasetStatus,
  useFeatureImportance,
  useLearningSummary,
  useModelFeedback,
  useModelPerformance,
  useModels,
  useModelTrainingRuns,
  useOnlineStatus,
  useProcessDataset,
  usePromoteModel,
  useRetrainModel,
  useTrainAdvancedModel,
  useUpdateOnlineLearner
} from '../hooks';
import type { AdvancedTrainingResult, DatasetStatus, ModelVersion, OnlineLearningStatus } from '../types';

export function ModelLifecyclePage() {
  const queryClient = useQueryClient();
  const models = useModels();
  const champion = useChampionModel();
  const performance = useModelPerformance();
  const summary = useLearningSummary();
  const feedback = useModelFeedback();
  const runs = useModelTrainingRuns();
  const alerts = useAlerts();
  const retrain = useRetrainModel();
  const promote = usePromoteModel();
  const dataset = useDatasetStatus();
  const processDataset = useProcessDataset();
  const trainModel = useTrainAdvancedModel();
  const compareModels = useCompareModels();
  const online = useOnlineStatus();
  const updateOnline = useUpdateOnlineLearner();
  const [modelType, setModelType] = useState('LIGHTGBM');
  const [timeframe, setTimeframe] = useState('5m');
  const [importanceModelId, setImportanceModelId] = useState<number>();
  const importance = useFeatureImportance(importanceModelId);

  useEffect(() => {
    if (!importanceModelId && champion.data?.id) {
      setImportanceModelId(champion.data.id);
    }
  }, [champion.data?.id, importanceModelId]);

  if (models.isError || champion.isError || performance.isError || summary.isError) {
    return <ErrorState message="Model lifecycle data is not reachable. Check the API and PostgreSQL migration status." />;
  }

  if (models.isLoading || champion.isLoading || performance.isLoading || summary.isLoading) {
    return <LoadingState label="Loading model lifecycle" />;
  }

  const active = champion.data!;
  const challengers = models.data?.filter((model) => model.status === 'CHALLENGER') ?? [];
  const modelAlerts = alerts.data?.filter((alert) => alert.type.startsWith('MODEL_')).slice(0, 5) ?? [];
  const championPerformance = performance.data?.find((model) => model.id === active.id);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['models'] });
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Adaptive Model Lifecycle</h1>
          <p className="text-sm text-muted">Paper trade feedback, challenger evaluation, and controlled model promotion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton icon={RefreshCw} label="Refresh Metrics" onClick={refresh} />
          <IconButton
            icon={RotateCcw}
            label={retrain.isPending ? 'Retraining' : 'Retrain Model'}
            onClick={() => retrain.mutate()}
            disabled={retrain.isPending}
            variant="primary"
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1fr_0.8fr]">
        <DatasetPanel status={dataset.data} pending={processDataset.isPending} onProcess={() => processDataset.mutate()} />
        <TrainingPanel
          modelType={modelType}
          timeframe={timeframe}
          pending={trainModel.isPending || compareModels.isPending}
          onModelType={setModelType}
          onTimeframe={setTimeframe}
          onTrain={() => trainModel.mutate({ modelType, timeframe })}
          onCompare={() => compareModels.mutate({ timeframe })}
        />
        <OnlinePanel status={online.data} pending={updateOnline.isPending} onUpdate={() => updateOnline.mutate()} />
      </div>

      <section className="rounded-md border border-buy/40 bg-buy/5 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-buy">Current champion</p>
            <h2 className="mt-1 text-2xl font-semibold">{active.version}</h2>
            <p className="mt-1 text-sm text-muted">{active.modelType.replace('_', ' ')} model trained {dateTime(active.trainedAt)}</p>
            <p className="mt-1 text-xs text-muted">{active.datasetSource ?? 'MOCK_SAMPLE'} / {active.timeframe ?? 'legacy timeframe'}</p>
          </div>
          <StatusBadge status={active.status} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <LifecycleMetric label="Training samples" value={String(active.trainingSamples)} />
          <LifecycleMetric label="Validation accuracy" value={percent(active.accuracy)} />
          <LifecycleMetric label="Observed win rate" value={percent(championPerformance?.winRate ?? active.winRate)} />
          <LifecycleMetric label="Average P/L" value={pnl(championPerformance?.avgPnl ?? active.avgPnl)} />
          <LifecycleMetric label="Signals" value={String(championPerformance?.signalCount ?? active._count?.signals ?? 0)} />
          <LifecycleMetric label="Feedback records" value={String(championPerformance?.feedbackCount ?? active._count?.feedbackRecords ?? 0)} />
        </div>
      </section>

      {compareModels.data ? <ComparisonTable comparison={compareModels.data.models} /> : null}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-md border border-line bg-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Performance by Model Version</h2>
              <p className="mt-1 text-xs text-muted">Observed paper feedback and local validation metrics</p>
            </div>
            <TrendingUp size={18} className="text-buy" />
          </div>
          <div className="h-[300px]">
            <PerformanceChart data={performance.data ?? []} />
          </div>
        </section>

        <section className="rounded-md border border-line bg-panel p-4">
          <div className="mb-4 flex items-center gap-2">
            <BrainCircuit size={18} className="text-buy" />
            <h2 className="text-sm font-semibold">Feedback Loop</h2>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <LifecycleMetric label="Total feedback" value={String(summary.data?.feedbackCount ?? 0)} />
            <LifecycleMetric label="New since retrain" value={String(summary.data?.newFeedbackCount ?? 0)} />
            <LifecycleMetric label="Recent win rate" value={percent(summary.data?.recentWinRate)} />
            <LifecycleMetric label="Last outcome" value={summary.data?.lastOutcome ?? 'Waiting'} />
          </dl>
          <div className={`mt-4 rounded-md border p-3 text-sm ${
            summary.data?.retrainRecommended ? 'border-hold/40 bg-hold/10 text-hold' : 'border-line bg-panelSoft text-muted'
          }`}>
            {summary.data?.retrainRecommended
              ? 'Feedback threshold reached. Retraining review is recommended.'
              : `${summary.data?.newFeedbackCount ?? 0}/${summary.data?.retrainMinFeedback ?? 25} new records collected before retraining is recommended.`}
          </div>
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Feature Importance</h2>
            <p className="mt-1 text-xs text-muted">Top tree-model drivers from the selected local artifact</p>
          </div>
          <select
            className="h-9 rounded-md border border-line bg-panelSoft px-3 text-sm text-ink"
            value={importanceModelId ?? ''}
            onChange={(event) => setImportanceModelId(Number(event.target.value))}
          >
            {(models.data ?? []).map((model) => <option key={model.id} value={model.id}>{model.version} / {model.modelType}</option>)}
          </select>
        </div>
        <div className="h-[300px]">
          <ImportanceChart data={(importance.data ?? []).slice(0, 10)} />
        </div>
      </section>

      <section className="rounded-md border border-line bg-panel">
        <div className="border-b border-line p-4">
          <h2 className="text-sm font-semibold">Challenger Models</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Trained</th>
                <th className="px-4 py-3">Accuracy</th>
                <th className="px-4 py-3">Win Rate</th>
                <th className="px-4 py-3">Avg P/L</th>
                <th className="px-4 py-3">Samples</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {challengers.map((model) => (
                <tr key={model.id}>
                  <td className="px-4 py-3 font-semibold">{model.version}</td>
                  <td className="px-4 py-3 text-muted">{dateTime(model.trainedAt)}</td>
                  <td className="px-4 py-3">{percent(model.accuracy)}</td>
                  <td className="px-4 py-3">{percent(model.winRate)}</td>
                  <td className="px-4 py-3">{pnl(model.avgPnl)}</td>
                  <td className="px-4 py-3">{model.trainingSamples}</td>
                  <td className="px-4 py-3 text-right">
                    <IconButton
                      icon={CheckCircle2}
                      label="Promote"
                      onClick={() => promote.mutate(model.id)}
                      disabled={promote.isPending}
                    />
                  </td>
                </tr>
              ))}
              {!challengers.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">No challenger model yet. Run a local retraining cycle to create one.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <TrainingRuns runs={runs.data ?? []} />
        <section className="rounded-md border border-line bg-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert size={18} className="text-hold" />
            <h2 className="text-sm font-semibold">Model Monitoring Alerts</h2>
          </div>
          <div className="space-y-3">
            {modelAlerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-line bg-panelSoft p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-muted">{alert.type}</span>
                  <span className="text-muted">{dateTime(alert.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm leading-5">{alert.message}</p>
              </div>
            ))}
            {!modelAlerts.length ? <p className="text-sm text-muted">No model lifecycle alerts yet.</p> : null}
          </div>
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel">
        <div className="border-b border-line p-4">
          <h2 className="text-sm font-semibold">Recent Paper Feedback</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Recorded</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">P/L</th>
                <th className="px-4 py-3">Holding Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(feedback.data ?? []).slice(0, 12).map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 text-muted">{dateTime(record.createdAt)}</td>
                  <td className="px-4 py-3">{record.modelVersion?.version ?? 'n/a'}</td>
                  <td className="px-4 py-3 font-medium">{record.signalValue}</td>
                  <td className="px-4 py-3">{percent(record.confidence)}</td>
                  <td className={`px-4 py-3 font-medium ${record.outcome === 'WIN' ? 'text-buy' : record.outcome === 'LOSS' ? 'text-sell' : 'text-hold'}`}>
                    {record.outcome}
                  </td>
                  <td className="px-4 py-3">{pnl(record.pnl)}</td>
                  <td className="px-4 py-3 text-muted">{duration(record.holdingSeconds)}</td>
                </tr>
              ))}
              {!feedback.data?.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">Feedback appears after a simulated paper trade closes.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DatasetPanel({ status, pending, onProcess }: { status?: DatasetStatus; pending: boolean; onProcess: () => void }) {
  const metadata = status?.metadata;
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="mb-4 flex items-center gap-2">
        <Database size={18} className="text-buy" />
        <h2 className="text-sm font-semibold">Historical Dataset</h2>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">Source</dt><dd>{status?.activeSource ?? 'Checking'}</dd>
        <dt className="text-muted">Rows</dt><dd>{metadata?.rowCount.toLocaleString() ?? 'Not processed'}</dd>
        <dt className="text-muted">Years</dt><dd>{metadata?.yearsIncluded.join(', ') ?? '-'}</dd>
        <dt className="text-muted">Range</dt><dd>{metadata ? `${dateTime(metadata.startDate)} - ${dateTime(metadata.endDate)}` : '-'}</dd>
        <dt className="text-muted">Timeframes</dt><dd>{status?.availableTimeframes.join(', ') || '-'}</dd>
      </dl>
      <IconButton
        className="mt-4"
        icon={Database}
        label={pending ? 'Processing' : 'Process Dataset'}
        onClick={onProcess}
        disabled={pending}
      />
    </section>
  );
}

function TrainingPanel({
  modelType,
  timeframe,
  pending,
  onModelType,
  onTimeframe,
  onTrain,
  onCompare
}: {
  modelType: string;
  timeframe: string;
  pending: boolean;
  onModelType: (value: string) => void;
  onTimeframe: (value: string) => void;
  onTrain: () => void;
  onCompare: () => void;
}) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="mb-4 flex items-center gap-2">
        <Cpu size={18} className="text-buy" />
        <h2 className="text-sm font-semibold">Advanced Model Training</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs uppercase text-muted">
          Model
          <select className="mt-2 h-9 w-full rounded-md border border-line bg-panelSoft px-2 text-sm text-ink" value={modelType} onChange={(event) => onModelType(event.target.value)}>
            <option value="RANDOM_FOREST">RandomForest</option>
            <option value="LIGHTGBM">LightGBM</option>
            <option value="XGBOOST">XGBoost</option>
          </select>
        </label>
        <label className="text-xs uppercase text-muted">
          Timeframe
          <select className="mt-2 h-9 w-full rounded-md border border-line bg-panelSoft px-2 text-sm text-ink" value={timeframe} onChange={(event) => onTimeframe(event.target.value)}>
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <IconButton icon={Play} label={pending ? 'Running' : 'Train Model'} onClick={onTrain} disabled={pending} variant="primary" />
        <IconButton icon={GitCompare} label="Compare Models" onClick={onCompare} disabled={pending} />
      </div>
    </section>
  );
}

function OnlinePanel({ status, pending, onUpdate }: { status?: OnlineLearningStatus; pending: boolean; onUpdate: () => void }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="mb-4 flex items-center gap-2">
        <BrainCircuit size={18} className="text-buy" />
        <h2 className="text-sm font-semibold">River Online Learner</h2>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">Mode</dt><dd>Experimental</dd>
        <dt className="text-muted">Records</dt><dd>{status?.recordsProcessed ?? 0}</dd>
        <dt className="text-muted">Rolling hit rate</dt><dd>{percent(status?.rollingAccuracy)}</dd>
        <dt className="text-muted">Updated</dt><dd>{dateTime(status?.lastUpdatedAt)}</dd>
      </dl>
      <IconButton className="mt-4" icon={RefreshCw} label={pending ? 'Updating' : 'Update Learner'} onClick={onUpdate} disabled={pending} />
    </section>
  );
}

function ComparisonTable({ comparison }: { comparison: AdvancedTrainingResult[] }) {
  return (
    <section className="rounded-md border border-line bg-panel">
      <div className="border-b border-line p-4">
        <h2 className="text-sm font-semibold">Latest Model Comparison</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Accuracy</th>
              <th className="px-4 py-3">Precision</th>
              <th className="px-4 py-3">Recall</th>
              <th className="px-4 py-3">F1</th>
              <th className="px-4 py-3">BUY Precision</th>
              <th className="px-4 py-3">SELL Precision</th>
              <th className="px-4 py-3">HOLD Precision</th>
              <th className="px-4 py-3">Train / Test</th>
              <th className="px-4 py-3">Seconds</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {comparison.map((model) => (
              <tr key={model.version}>
                <td className="px-4 py-3 font-semibold">{model.modelType}</td>
                <td className="px-4 py-3">{percent(model.metrics.accuracy)}</td>
                <td className="px-4 py-3">{percent(model.metrics.precision)}</td>
                <td className="px-4 py-3">{percent(model.metrics.recall)}</td>
                <td className="px-4 py-3">{percent(model.metrics.f1Score)}</td>
                <td className="px-4 py-3">{percent(model.metrics.classPrecision.BUY)}</td>
                <td className="px-4 py-3">{percent(model.metrics.classPrecision.SELL)}</td>
                <td className="px-4 py-3">{percent(model.metrics.classPrecision.HOLD)}</td>
                <td className="px-4 py-3 text-muted">{model.split.trainingRows.toLocaleString()} / {model.split.testRows.toLocaleString()}</td>
                <td className="px-4 py-3">{model.trainingTimeSeconds.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImportanceChart({ data }: { data: Array<{ feature: string; importance: number }> }) {
  if (!data.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Feature importance appears after training a V4 tree model.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={[...data].reverse()} layout="vertical" margin={{ top: 4, right: 18, bottom: 0, left: 32 }}>
        <CartesianGrid stroke="#26303d" strokeDasharray="3 3" />
        <XAxis type="number" stroke="#506070" />
        <YAxis type="category" dataKey="feature" width={125} stroke="#506070" />
        <Tooltip contentStyle={{ background: '#11151c', border: '1px solid #26303d', borderRadius: 6 }} />
        <Bar dataKey="importance" fill="#38d39f" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LifecycleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panelSoft p-3">
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: ModelVersion['status'] }) {
  const tone = status === 'CHAMPION' ? 'border-buy/40 bg-buy/10 text-buy' : 'border-hold/40 bg-hold/10 text-hold';
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function PerformanceChart({ data }: { data: Array<{ version: string; winRate: number; accuracy?: number | null; avgPnl: number; feedbackCount: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#26303d" strokeDasharray="3 3" />
        <XAxis dataKey="version" stroke="#506070" />
        <YAxis yAxisId="rate" tickFormatter={(value) => `${Math.round(value * 100)}%`} stroke="#506070" />
        <YAxis yAxisId="count" orientation="right" stroke="#506070" />
        <Tooltip contentStyle={{ background: '#11151c', border: '1px solid #26303d', borderRadius: 6 }} />
        <Legend />
        <Bar yAxisId="count" dataKey="feedbackCount" name="Feedback" fill="#506070" />
        <Line yAxisId="rate" type="monotone" dataKey="winRate" name="Win rate" stroke="#38d39f" strokeWidth={2} />
        <Line yAxisId="rate" type="monotone" dataKey="accuracy" name="Validation accuracy" stroke="#f3b852" strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function TrainingRuns({ runs }: { runs: Array<{ id: number; startedAt: string; status: string; trigger: string; samplesUsed?: number | null; challengerVersion?: string | null; promoted: boolean; errorMessage?: string | null }> }) {
  return (
    <section className="rounded-md border border-line bg-panel">
      <div className="border-b border-line p-4">
        <h2 className="text-sm font-semibold">Training Runs</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Samples</th>
              <th className="px-4 py-3">Promoted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {runs.slice(0, 8).map((run) => (
              <tr key={run.id}>
                <td className="px-4 py-3 text-muted">{dateTime(run.startedAt)}</td>
                <td className="px-4 py-3 font-medium">{run.status}</td>
                <td className="px-4 py-3 text-muted">{run.trigger}</td>
                <td className="px-4 py-3">{run.challengerVersion ?? '-'}</td>
                <td className="px-4 py-3">{run.samplesUsed ?? '-'}</td>
                <td className="px-4 py-3">{run.promoted ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {!runs.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">No retraining runs yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function pnl(value?: number | null) {
  return value === undefined || value === null ? 'n/a' : `${value >= 0 ? '+' : ''}$${value.toFixed(2)}`;
}

function duration(seconds?: number | null) {
  if (seconds === undefined || seconds === null) {
    return 'n/a';
  }
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
}