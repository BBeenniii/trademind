import type { ReactNode } from 'react';

export function ChartShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <div className="mb-4 flex min-h-9 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="h-72 min-h-72">{children}</div>
    </section>
  );
}