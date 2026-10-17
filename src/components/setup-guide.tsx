"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { currentChecklist } from "@/app/dashboard/events/[eventId]/setup-actions";
import type { SetupChecklist, SetupStep } from "@/lib/setup-checklist";

/**
 * The host's setup checklist on the event page: a sticky panel beside it on
 * a computer, and a light bar along the bottom of a phone (showing the next
 * step) that slides up a drawer.
 */
export function SetupGuide({ checklist }: { checklist: SetupChecklist }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const { progress, next, complete } = checklist;

  return (
    <>
      {/* Computer: beside the page, staying in view as you scroll. */}
      <aside aria-label="Setup checklist" className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-card">
          {complete ? (
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

      {/* Phone and tablet: a light bar along the bottom with the next step; it opens the drawer. */}
      {!complete && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden print:hidden">
          <ProgressLine progress={progress} />
          <button
            type="button"
            onClick={() => drawer.current?.showModal()}
            aria-haspopup="dialog"
            className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block text-xs text-muted">Setup checklist · {progress.label}</span>
              <span className="block truncate text-sm font-semibold">{next ? `Next: ${next.label}` : "See the checklist"}</span>
            </span>
            <span aria-hidden className="text-lg text-brand">
              ›
            </span>
          </button>
        </div>
      )}
      <ChecklistDrawer drawer={drawer} checklist={checklist} />
    </>
  );
}

/** Pages where the host is running the day, not setting up: no setup bar there. */
const DAY_SCREENS = ["/contest-day", "/event-day", "/volunteers", "/conferences/meetings"];

/**
 * On every other page of the event: one slim line with where setup stands and
 * the next step, kept current as the host moves between pages. Sits above the
 * page (not pinned), so it never covers a page's own Save or Publish bar.
 */
export function SetupStrip({ eventId, initial }: { eventId: string; initial: SetupChecklist }) {
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const [checklist, setChecklist] = useState(initial);
  const base = `/dashboard/events/${eventId}`;
  const hidden = pathname === base || DAY_SCREENS.some((p) => pathname.startsWith(`${base}${p}`));

  // Each page change: read it again, so a step finished on the last page shows as done.
  useEffect(() => {
    if (hidden) return;
    let live = true;
    currentChecklist(eventId).then((c) => {
      if (live && c) setChecklist(c);
    });
    return () => {
      live = false;
    };
  }, [eventId, pathname, hidden]);

  if (hidden || checklist.complete) return null;
  const { next, progress } = checklist;
  const here = next && next.href.split(/[?#]/)[0] === pathname;
  return (
    <>
      <div className="mb-5 overflow-hidden rounded-lg border border-border bg-surface text-sm print:hidden">
        <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
          <p className="min-w-0 flex-1 leading-6">
            <span className="font-semibold">Setup</span> <span className="text-muted">· {progress.label}</span>
            {next && (
              <span className="block truncate sm:ml-1 sm:inline">
                <span className="hidden text-muted sm:inline">· </span>
                {here ? (
                  <span>
                    <span className="text-muted">You&apos;re on the next step:</span> <span className="font-medium">{next.label}</span>
                  </span>
                ) : (
                  <>
                    <span className="text-muted">Next:</span>{" "}
                    <Link href={next.href} className="font-medium text-brand underline-offset-4 hover:underline">
                      {next.label}
                    </Link>
                  </>
                )}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => drawer.current?.showModal()}
            aria-haspopup="dialog"
            className="inline-flex min-h-10 shrink-0 items-center rounded-md px-2 font-medium text-brand hover:bg-brand-soft"
          >
            Checklist <span aria-hidden>&nbsp;›</span>
          </button>
        </div>
        <ProgressLine progress={progress} />
      </div>
      <ChecklistDrawer drawer={drawer} checklist={checklist} everywhere />
    </>
  );
}

function ProgressLine({ progress }: { progress: SetupChecklist["progress"] }) {
  const pct = Math.round((progress.done / progress.of) * 100);
  return (
    <div className="h-1 bg-border" aria-hidden>
      <div className="h-full bg-success" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The full checklist in a sheet that slides up (phones), or a centered panel (computers, from the strip). */
function ChecklistDrawer({
  drawer,
  checklist,
  everywhere = false,
}: {
  drawer: RefObject<HTMLDialogElement | null>;
  checklist: SetupChecklist;
  /** Opened from the strip, so on computers too. */
  everywhere?: boolean;
}) {
  return (
    <dialog
      ref={drawer}
      aria-label="Setup checklist"
      onClick={(e) => e.target === e.currentTarget && drawer.current?.close()}
      className={`mx-0 mt-auto mb-0 max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-border bg-surface p-0 text-foreground shadow-elevated backdrop:bg-[#071a31]/50 ${
        everywhere ? "sm:m-auto sm:max-w-md sm:rounded-2xl" : "lg:hidden"
      }`}
    >
      <div className="px-5 pb-8 pt-3">
        <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex justify-end">
          <button type="button" onClick={() => drawer.current?.close()} className="min-h-11 rounded-md px-3 text-sm font-medium text-muted hover:text-foreground">
            Close
          </button>
        </div>
        <Steps checklist={checklist} onNavigate={() => drawer.current?.close()} />
      </div>
    </dialog>
  );
}

function Steps({ checklist, onNavigate }: { checklist: SetupChecklist; onNavigate?: () => void }) {
  const { progress, next } = checklist;
  return (
    <div>
      <h2 className="text-lg font-semibold">Setup checklist</h2>
      <p className="mt-1 text-sm text-muted">{progress.label}</p>
      <div className="mt-3 overflow-hidden rounded-full">
        <ProgressLine progress={progress} />
      </div>

      <Group title="Before you publish" steps={checklist.before} next={next} onNavigate={onNavigate} />
      {/* Publishing is the step between the two lists, not a list of its own. */}
      <ol className="mt-4 border-y border-border py-2">
        <Step step={checklist.publish} next={next} onNavigate={onNavigate} />
      </ol>
      {checklist.after.length > 0 && <Group title="After you publish" steps={checklist.after} next={next} onNavigate={onNavigate} />}
    </div>
  );
}

/** Open steps first; finished ones fold into one line you can open. */
function Group({ title, steps, next, onNavigate }: { title: string; steps: SetupStep[]; next: SetupStep | null; onNavigate?: () => void }) {
  const open = steps.filter((s) => !s.done);
  const done = steps.filter((s) => s.done);
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {open.length > 0 && (
        <ol className="mt-2 space-y-1">
          {open.map((s) => (
            <Step key={s.id} step={s} next={next} onNavigate={onNavigate} />
          ))}
        </ol>
      )}
      {done.length > 0 && (
        <details className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-muted hover:bg-brand-soft">
            <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground">
              ✓
            </span>
            {done.length} done · <span className="font-medium text-brand">Show</span>
          </summary>
          <ol className="mt-1 space-y-1">
            {done.map((s) => (
              <Step key={s.id} step={s} next={next} onNavigate={onNavigate} />
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function Step({ step: s, next, onNavigate }: { step: SetupStep; next: SetupStep | null; onNavigate?: () => void }) {
  const isNext = next?.id === s.id;
  return (
    <li>
      <Link
        href={s.href}
        onClick={onNavigate}
        aria-current={isNext ? "step" : undefined}
        className={`flex min-h-11 items-start gap-3 rounded-md px-2 py-2 ${isNext ? "bg-brand-soft ring-1 ring-brand/30" : "hover:bg-brand-soft"}`}
      >
        {/* Status only: the whole row is a link to where the step is done. */}
        <span
          aria-hidden
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            s.done ? "bg-success text-success-foreground" : "ring-2 ring-field-border"
          }`}
        >
          {s.done ? "✓" : ""}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${s.done ? "text-muted" : ""}`}>
            {s.label}
            <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
            {isNext && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[11px] font-semibold text-brand-foreground">Next</span>}
            {!s.required && !s.done && (
              <span className="ml-2 rounded-full bg-background px-2 py-0.5 align-middle text-[11px] font-semibold text-muted ring-1 ring-border">
                Optional
              </span>
            )}
          </span>
          {!s.done && <span className="mt-0.5 block text-xs leading-5 text-muted">{s.hint}</span>}
        </span>
        {!s.done && (
          <span aria-hidden className="mt-0.5 shrink-0 text-brand">
            →
          </span>
        )}
      </Link>
    </li>
  );
}
