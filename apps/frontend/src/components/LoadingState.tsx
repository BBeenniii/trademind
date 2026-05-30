export function LoadingState({ label = 'Loading market research data' }: { label?: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-6 text-sm text-muted">
      {label}...
    </div>
  );
}