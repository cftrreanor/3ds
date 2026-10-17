import type { ReactNode } from "react";

/**
 * A setup page's publishing bar: what's live, and the buttons to publish or
 * hide it. Always on screen: pinned under the title on a computer, to the
 * bottom on a phone. Saving never lives here; Save buttons sit with the boxes
 * they save (see "Setup pages" in docs/DESIGN.md). Put it in a flex column
 * with the page's steps; it moves itself first (computer) or last (phone).
 */
export function PublishBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[var(--day-bar,0px)] z-10 order-last -mx-4 space-y-2 border-t-2 border-brand bg-surface px-4 py-3 shadow-[0_-6px_16px_rgb(0_0_0/0.12)] sm:order-first sm:top-0 sm:bottom-auto sm:mx-0 sm:mb-3 sm:rounded-lg sm:border-2 sm:px-5 sm:shadow-lg">
      {children}
    </div>
  );
}

/** One thing that can go live: a dot, its name and status, and its buttons. */
export function PublishLine({ label, status, on, children }: { label: string; status: string; on: boolean; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? "bg-success" : "border-2 border-muted"}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm leading-5">
        <span className="font-semibold">{label}</span> <span className="text-muted">· {status}</span>
      </span>
      {children && <div className="flex shrink-0 gap-2">{children}</div>}
    </div>
  );
}
