import type { DayStatus as Status, DayTone } from "@/lib/director-day";

const TONE: Record<DayTone, { box: string; icon: string; label: string }> = {
  green: { box: "border-success bg-success-soft", icon: "✓", label: "On track" },
  gold: { box: "border-warning bg-warning-soft", icon: "⏱", label: "Coming up" },
  now: { box: "border-brand bg-brand-soft", icon: "▶", label: "Now" },
  red: { box: "border-danger bg-danger/10", icon: "!", label: "Running late" },
  done: { box: "border-success bg-success-soft", icon: "🎉", label: "All done" },
};

/**
 * A director's day at a glance, readable from arm's length: one colour, one
 * line for what's next, and how many steps are done.
 */
export function DayStatusBanner({
  status,
  doneText,
  phone,
}: {
  status: Status;
  /** Shown when every step is done. */
  doneText: string;
  /** The host's number, offered when running late. */
  phone?: string | null;
}) {
  const t = TONE[status.tone];
  return (
    <div className={`rounded-xl border-2 px-4 py-3 ${t.box}`} role="status" aria-label={t.label}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            status.tone === "red" ? "bg-danger text-danger-foreground" : status.tone === "gold" ? "bg-warning text-foreground" : status.tone === "now" ? "bg-brand text-brand-foreground" : "bg-success text-success-foreground"
          }`}
        >
          {t.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-6">{status.tone === "done" ? doneText : status.title}</p>
          {status.detail && <p className="mt-0.5 text-sm font-medium">{status.detail}</p>}
          {status.tone === "red" && phone && (
            <a href={`tel:${phone}`} className="mt-2 inline-flex min-h-10 items-center rounded-md bg-danger px-4 text-sm font-semibold text-danger-foreground">
              Call the host
            </a>
          )}
        </div>
      </div>
      {status.total > 0 && (
        <div className="mt-3">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: status.total }, (_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < status.done ? "bg-success" : "bg-foreground/15"}`} />
            ))}
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            {status.done} of {status.total} steps done
          </p>
        </div>
      )}
    </div>
  );
}

/** The same status, small, for dashboard cards. */
export function DayStatusPill({ status, doneText }: { status: Status; doneText: string }) {
  const t = TONE[status.tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${t.box}`}>
      <span aria-hidden className="font-bold">
        {t.icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{status.tone === "done" ? doneText : status.title}</span>
        {status.tone !== "done" && status.detail && <span className="block text-xs">{status.detail}</span>}
      </span>
    </div>
  );
}
