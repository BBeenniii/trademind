export function ErrorState({ message = 'The API is not reachable yet.' }: { message?: string }) {
  return (
    <div className="rounded-md border border-sell/40 bg-sell/10 p-6 text-sm text-sell">
      {message}
    </div>
  );
}