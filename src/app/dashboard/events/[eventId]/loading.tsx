// Shown while an event page loads, so a slow connection on event day doesn't look
// like a tap that did nothing. The shape matches a page header and its first cards.
export default function EventLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="space-y-3 motion-safe:animate-pulse">
        <div className="h-4 w-40 rounded bg-border" />
        <div className="h-9 w-3/4 max-w-md rounded bg-border" />
        <div className="h-4 w-56 rounded bg-border" />
      </div>
      {[0, 1, 2].map((n) => (
        <div key={n} aria-hidden className="h-32 rounded-lg border border-border bg-surface motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
