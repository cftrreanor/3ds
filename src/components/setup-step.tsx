import type { ReactNode } from "react";

/**
 * One numbered step of a setup page ("1. Station details", "2. Open
 * registration"): an accordion whose title says whether it's done. See
 * "Setup pages" in docs/DESIGN.md.
 */
export function SetupStep({
  id,
  title,
  status,
  open,
  intro,
  children,
}: {
  id?: string;
  /** With its number: "1. Registration settings". */
  title: string;
  status: ReactNode;
  /** Open to start: usually while it's still to do. */
  open: boolean;
  /** One line under the title saying what this step is for. */
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details id={id} className="group scroll-mt-6 rounded-lg border border-border bg-surface px-4 py-3" open={open}>
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="text-muted transition group-open:rotate-90">
            ▸
          </span>
          {title}
        </span>
        {status}
      </summary>
      {intro && <p className="mt-2 text-sm text-muted">{intro}</p>}
      <div className="mt-4">{children}</div>
    </details>
  );
}

/** Beside a step's title: done (green ✓), or still to do. Other words when "done" or "to do" don't fit. */
export function StepStatus({ done, doneLabel = "Done", todoLabel = "Needs to be done" }: { done: boolean; doneLabel?: string; todoLabel?: string }) {
  return done ? (
    <span className="flex items-center gap-1 text-sm font-semibold text-success">
      <span aria-hidden>✓</span> {doneLabel}
    </span>
  ) : (
    <span className="text-sm text-muted italic">{todoLabel}</span>
  );
}
