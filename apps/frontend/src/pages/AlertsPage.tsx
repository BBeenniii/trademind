import { BellRing } from 'lucide-react';
import { ErrorState } from '../components/ErrorState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { dateTime } from '../format';
import { useAlerts, useTestAlert } from '../hooks';

export function AlertsPage() {
  const alerts = useAlerts();
  const testAlert = useTestAlert();

  if (alerts.isError) {
    return <ErrorState />;
  }

  if (alerts.isLoading) {
    return <LoadingState label="Loading alert history" />;
  }

  return (
    <section className="rounded-md border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div>
          <h1 className="text-base font-semibold">Alert Workflow</h1>
          <p className="text-sm text-muted">Database-backed alerts from signals, risk thresholds and reports</p>
        </div>
        <IconButton
          icon={BellRing}
          label={testAlert.isPending ? 'Sending' : 'Test Alert'}
          onClick={() => testAlert.mutate()}
          disabled={testAlert.isPending}
          variant="primary"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(alerts.data ?? []).map((alert) => (
              <tr key={alert.id}>
                <td className="px-4 py-3 text-muted">{dateTime(alert.createdAt)}</td>
                <td className="px-4 py-3 font-medium">{alert.type}</td>
                <td className="px-4 py-3">{alert.severity}</td>
                <td className="px-4 py-3 text-muted">{alert.status}</td>
                <td className="px-4 py-3 text-muted">{alert.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}