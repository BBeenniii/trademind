import type { LucideIcon } from 'lucide-react';

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
};

const tones = {
  neutral: 'text-ink',
  good: 'text-buy',
  warn: 'text-hold',
  bad: 'text-sell'
};

export function MetricCard({ label, value, detail, icon: Icon, tone = 'neutral' }: MetricCardProps) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
        </div>
        <div className="rounded-md border border-line bg-panelSoft p-2 text-muted">
          <Icon size={18} />
        </div>
      </div>
      {detail ? <p className="mt-3 min-h-5 text-sm text-muted">{detail}</p> : null}
    </section>
  );
}