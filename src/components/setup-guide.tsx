"use client";

import Link from "next/link";
import { useRef } from "react";
import type { SetupChecklist, SetupStep } from "@/lib/setup-checklist";

/**
 * The host's setup checklist: a sticky panel beside the event page on a
 * computer, and a bar along the bottom of a phone that slides up a drawer.
 */
export function SetupGuide({ checklist }: { checklist: SetupChecklist }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const allDone = checklist.doneCount === checklist.total;
  const progress = `${checklist.doneCount} of ${checklist.total} done`;

  return (
    <>
      {/* Computer: beside the page, staying in view as you scroll. */}
      <aside aria-label="Setup checklist" className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-card">
          {allDone ? (
            // Everything's done: a small note, with the list a tap away.
            <details>
              <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span className="text-success">✓</span> Setup complete
                <span className="mt-1 block text-xs font-normal text-muted">Show the checklist</span>
              </summary>
              <div className="mt-3">
                <Steps checklist={checklist} />
              </div>
            </details>
          ) : (
            <Steps checklist={checklist} />
          )}
        </div>
      </aside>

      {/* Phone and tablet: a bar along the bottom that opens the drawer. */}
      {!allDone && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => drawer.current?.showModal()}
            aria-haspopup="dialog"
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-brand px-4 text-left text-sm font-semibold text-brand-foreground"
          >
            <span>Setup checklist</span>
            <span className="flex items-center gap-2 font-medium opacity-90">
              {progress}
              <span aria-hidden>▴</span>
            </span>
          </button>
        </div>
      )}
      <dialog
        ref={drawer}
        aria-label="Setup checklist"
        onClick={(e) => e.target === e.currentTarget && drawer.current?.close()}
        className="mx-0 mt-auto mb-0 max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-border bg-surface p-0 text-foreground shadow-elevated backdrop:bg-[#071a31]/50 lg:hidden"
      >
        <div className="px-5 pb-8 pt-3">
          <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
          <div className="flex justify-end">
            <button type="button" onClick={() => drawer.current?.close()} className="min-h-11 rounded-md px-3 text-sm font-medium text-muted hover:text-foreground">
              Close
            </button>
          </div>
          <Steps checklist={checklist} onNavigate={() => drawer.current?.close()} />
        </div>
      </dialog>
    </>
  );
}

function Steps({ checklist, onNavigate }: { checklist: SetupChecklist; onNavigate?: () => void }) {
  const pct = Math.round((checklist.doneCount / checklist.total) * 100);
  return (
    <div>
      <h2 className="text-lg font-semibold">Setup checklist</h2>
      <p className="mt-1 text-sm text-muted">
        {checklist.doneCount === checklist.total ? "All set" : `${checklist.doneCount} of ${checklist.total} done`}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>

      <Group title="Before you publish" steps={checklist.before} onNavigate={onNavigate} />
      <Group title="Go live" steps={[checklist.publish]} onNavigate={onNavigate} />
      {checklist.after.length > 0 && <Group title="After you publish" steps={checklist.after} onNavigate={onNavigate} />}
    </div>
  );
}

function Group({ title, steps, onNavigate }: { title: string; steps: SetupStep[]; onNavigate?: () => void }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <ol className="mt-2 space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              href={s.href}
              onClick={onNavigate}
              className="group flex min-h-11 gap-3 rounded-md px-2 py-2 hover:bg-brand-soft"
            >
              <span
                aria-hidden
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.done ? "bg-success text-success-foreground" : "ring-2 ring-field-border"
                }`}
              >
                {s.done ? "✓" : ""}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${s.done ? "text-muted line-through decoration-1" : ""}`}>
                  {s.label}
                  <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                </span>
                {!s.done && (
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {s.required ? "" : "Optional. "}
                    {s.hint}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
