"use client";

import Link from "next/link";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toaster";
import { Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { RECORDS_NOTE } from "@/lib/records";

export type Outcome = "met" | "no_show" | null;

export type MeetingParent = {
  name: string;
  email: string;
  phone: string | null;
  phoneDisplay: string | null;
};

export type MeetingRow =
  | {
      kind: "meeting";
      key: string;
      time: string;
      /** Weekly hours: the meeting's day ("2026-11-03") and how it reads ("Tuesday, Nov 3"). */
      day?: string;
      dayLabel?: string;
      /** Its time has passed (on or after the day). */
      over: boolean;
      /** On the day: this meeting is happening now, is up next, or is over. */
      status: "now" | "next" | "past" | null;
      booking: {
        id: string;
        /** Null when the teacher doesn't ask for the child's name. */
        child: string | null;
        parents: MeetingParent[];
        mode: string | null;
        /** Phone calls: the number to call. */
        call: { tel: string; display: string } | null;
        note: string | null;
        cancel: (prev: ActionState, formData: FormData) => Promise<ActionState>;
        /** The meeting's time has come: Met / No-show replace Cancel. */
        started: boolean;
        /** undefined until the conference outcomes database update has been run. */
        outcome: Outcome | undefined;
        setOutcome: (outcome: Outcome) => Promise<ActionState>;
      } | null;
    }
  | { kind: "break"; key: string; time: string; label: string; over: boolean };

const OUTCOMES: { value: "met" | "no_show"; label: string; on: string }[] = [
  { value: "met", label: "Met", on: "border-success bg-success-soft" },
  { value: "no_show", label: "No-show", on: "border-warning bg-warning-soft" },
];

const STATUS: Record<"now" | "next" | "past", string> = {
  now: "Now",
  next: "Up next",
  past: "Done",
};

/** The teacher's meetings in time order, like the parent check-in list: a count, a search box, one card per family. */
export function MeetingList({
  rows,
  booked,
  total,
  summaryHref,
  today,
}: {
  /** Weekly hours: today's date, to list Today, Needs marking, and Upcoming by day. */
  today?: string;
  rows: MeetingRow[];
  booked: number;
  /** Meeting times in all (a conference day), or null for weekly hours (booked meetings only). */
  total: number | null;
  /** The one-page summary to print or save as a PDF. */
  summaryHref: string;
}) {
  // Who each booking is: the child, or with no child's name, the first parent.
  const nameOf = (b: { child: string | null; parents: MeetingParent[] }) => b.child ?? b.parents[0]?.name ?? "";
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Taps show at once, like parent check-in; the page catches up when the save lands.
  const [outcomes, setOptimistic] = useOptimistic(
    Object.fromEntries(rows.flatMap((r) => (r.kind === "meeting" && r.booking ? [[r.key, r.booking.outcome]] : []))) as Record<
      string,
      Outcome | undefined
    >,
    (state, change: { key: string; outcome: Outcome }) => ({ ...state, [change.key]: change.outcome }),
  );
  const marked = Object.values(outcomes);
  const met = marked.filter((o) => o === "met").length;
  const noShows = marked.filter((o) => o === "no_show").length;

  function mark(key: string, current: Outcome | undefined, value: "met" | "no_show", save: (o: Outcome) => Promise<ActionState>) {
    const next = current === value ? null : value;
    setError(null);
    startTransition(async () => {
      setOptimistic({ key, outcome: next });
      try {
        const result = await save(next);
        if (result.error) setError(result.error);
      } catch {
        setError("That didn't go through. Check your signal and tap again.");
      }
    });
  }
  const [openTimes, setOpenTimes] = useState(true);
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      rows.filter((r) => {
        if (r.kind === "break") return !q && openTimes;
        if (!r.booking) return !q && openTimes;
        return (
          !q ||
          [r.booking.child ?? "", ...r.booking.parents.flatMap((p) => [p.name, p.email, p.phone ?? ""])].some((x) => x.toLowerCase().includes(q))
        );
      }),
    [rows, q, openTimes],
  );
  const emails = [...new Set(rows.flatMap((r) => (r.kind === "meeting" && r.booking ? r.booking.parents.map((p) => p.email) : [])))];

  // Marked meetings drop to Past meetings, so the next one is always at the top.
  // On the day, open times and breaks that are over drop out too.
  const isDone = (r: MeetingRow) => r.kind === "meeting" && Boolean(r.booking) && Boolean(outcomes[r.key]);
  const upcoming = shown.filter((r) => !isDone(r) && !(r.over && (r.kind === "break" || !r.booking)));
  const finished = shown.filter(isDone);
  // Weekly hours: today's meetings first, then earlier ones still to mark, then later days.
  const dayOf = (r: MeetingRow) => (r.kind === "meeting" ? (r.day ?? "") : "");
  const todays = today ? upcoming.filter((r) => dayOf(r) === today) : [];
  const toMark = today ? upcoming.filter((r) => dayOf(r) < today) : [];
  const later = today ? upcoming.filter((r) => dayOf(r) > today) : [];
  const laterDays = [...new Map(later.map((r) => [dayOf(r), r.kind === "meeting" ? (r.dayLabel ?? "") : ""]))];

  const row = (r: MeetingRow) =>
    r.kind === "break" ? (
      <li key={r.key} className="flex gap-4 px-3 py-1 text-sm text-muted">
        <span className="w-36 shrink-0 tabular-nums">{r.time}</span>
        <span>{r.label}</span>
      </li>
    ) : r.booking ? (
      <li
        key={r.key}
        // The teacher's emails and calendar invite link straight here ("Mark Met or No-show").
        id={`meeting-${r.booking.id}`}
        className={`scroll-mt-52 break-inside-avoid rounded-xl border shadow-card target:ring-2 target:ring-brand print:shadow-none ${
          r.status === "now" ? "border-brand ring-2 ring-brand" : "border-border"
        } ${r.status === "past" ? "bg-background shadow-none" : "bg-surface"}`}
      >
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold tabular-nums">{r.time}</span>
              {r.status && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.status === "now" ? "bg-brand text-brand-foreground" : "bg-background text-muted ring-1 ring-border"
                  }`}
                >
                  {STATUS[r.status]}
                </span>
              )}
              {r.booking.mode && <span className="text-muted">· {r.booking.mode}</span>}
              {outcomes[r.key] && (
                <span className="hidden font-semibold print:inline">· {outcomes[r.key] === "met" ? "Met" : "No-show"}</span>
              )}
            </p>
            <p className="text-lg font-semibold">{nameOf(r.booking)}</p>
            {r.booking.call && (
              <a
                href={`tel:${r.booking.call.tel}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-brand px-3 text-sm font-semibold text-brand hover:bg-brand-soft print:min-h-0 print:border-0 print:px-0"
              >
                <span aria-hidden>📞</span> Call {r.booking.call.display}
              </a>
            )}
            <ul className="text-sm">
              {r.booking.parents.map((p) => (
                <li key={p.email} className="flex flex-wrap items-center gap-x-4">
                  <span className="font-medium">{p.name}</span>
                  <a href={`mailto:${p.email}`} className="inline-flex min-h-11 items-center text-brand hover:underline print:min-h-0">
                    {p.email}
                  </a>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="inline-flex min-h-11 items-center text-brand hover:underline print:min-h-0">
                      {p.phoneDisplay}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {r.booking.note && (
              <p className="mt-1 rounded-md bg-background px-3 py-2 text-sm">
                <span className="font-medium">Note: </span>
                {r.booking.note}
              </p>
            )}
          </div>
          {r.booking.started && r.booking.outcome !== undefined ? (
            <div
              className="flex shrink-0 gap-2 print:hidden"
              role="group"
              aria-label={`How the meeting with ${nameOf(r.booking)}'s family went`}
            >
              {OUTCOMES.map((o) => {
                const on = outcomes[r.key] === o.value;
                const booking = r.booking!;
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => mark(r.key, outcomes[r.key], o.value, booking.setOutcome)}
                    className={`min-h-11 min-w-24 rounded-md border px-3 text-sm font-semibold transition ${
                      on ? `${o.on} text-foreground` : "border-field-border bg-surface hover:border-brand"
                    }`}
                  >
                    {on && <span aria-hidden>✓ </span>}
                    {o.label}
                  </button>
                );
              })}
            </div>
          ) : (
            !r.booking.started && (
              <ActionForm
                action={r.booking.cancel}
                resetOnSuccess={false}
                confirmMessage={`Cancel the meeting with ${nameOf(r.booking)}'s family? We'll email them that you canceled, delete their details, and open the time up again.`}
                className="shrink-0 print:hidden"
              >
                <SubmitButton variant="ghost" pendingText="Canceling…" className="-ml-4 font-medium underline hover:text-danger">
                  Cancel meeting
                </SubmitButton>
              </ActionForm>
            )
          )}
        </div>
      </li>
    ) : (
      <li key={r.key} className="flex gap-4 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm">
        <span className="w-36 shrink-0 tabular-nums text-muted">{r.time}</span>
        <span className="text-muted">Open</span>
      </li>
    );

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur print:static print:border-0 print:p-0 sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            <span className="text-2xl font-semibold tabular-nums">{booked}</span>
            <span className="text-muted">
              {" "}
              {total === null ? ` ${booked === 1 ? "meeting" : "meetings"} booked` : ` / ${total} times booked · ${total - booked} open`}
              {met + noShows > 0 && ` · ${met} met · ${noShows} ${noShows === 1 ? "no-show" : "no-shows"}`}
            </span>
          </p>
          <Input
            type="search"
            placeholder="Child, parent, or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-xs print:hidden"
            aria-label="Find a family"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-5 text-sm print:hidden">
          {total === null ? (
            // Weekly hours list booked meetings only.
            <span />
          ) : (
            <label className="inline-flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={openTimes} onChange={(e) => setOpenTimes(e.target.checked)} className="h-4 w-4" />
              Show open times and breaks
            </label>
          )}
          <details className="group relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-medium text-brand hover:underline">
              Print or copy
              <span aria-hidden className="text-xs transition group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-2 shadow-lg">
              <ul>
                <li>
                  <Link href={summaryHref} className="flex min-h-11 items-center rounded-md px-3 font-medium hover:bg-background">
                    Print summary
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-md px-3 text-left font-medium hover:bg-background"
                    onClick={() => window.print()}
                  >
                    Print full list
                  </button>
                </li>
                {emails.length > 0 && (
                  <li>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center rounded-md px-3 text-left font-medium hover:bg-background"
                      onClick={async () => {
                        const list = emails.join(", ");
                        try {
                          await navigator.clipboard.writeText(list);
                          toast(`Copied ${emails.length} parent ${emails.length === 1 ? "email" : "emails"}`);
                        } catch {
                          window.prompt("Copy these emails:", list);
                        }
                      }}
                    >
                      Copy all parent emails
                    </button>
                  </li>
                )}
              </ul>
              <p className="mt-1 border-t border-border px-3 pt-2 text-xs text-muted">{RECORDS_NOTE}</p>
            </div>
          </details>
        </div>
        {error && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-muted">{q ? "No family matches that." : "No meetings booked yet."}</p>
      ) : (
        <>
          {today ? (
            <>
              <section className="mt-5" aria-labelledby="today-meetings">
                <h2 id="today-meetings" className="text-lg font-semibold">
                  Today
                </h2>
                {todays.length > 0 ? (
                  <ol className="mt-3 space-y-3">{todays.map(row)}</ol>
                ) : (
                  <p className="mt-1 text-muted">{q ? "No family matches that today." : "No meetings today."}</p>
                )}
              </section>
              {toMark.length > 0 && (
                <section className="mt-10 print:mt-6" aria-labelledby="needs-marking">
                  <h2 id="needs-marking" className="text-lg font-semibold">
                    Needs marking <span className="font-normal text-muted">({toMark.length})</span>
                  </h2>
                  <p className="mt-1 text-sm text-muted print:hidden">Earlier meetings. Mark each one Met or No-show.</p>
                  <ol className="mt-3 space-y-3">{toMark.map(row)}</ol>
                </section>
              )}
              {later.length > 0 && (
                <section className="mt-10 print:mt-6" aria-labelledby="upcoming-meetings">
                  <h2 id="upcoming-meetings" className="text-lg font-semibold">
                    Upcoming <span className="font-normal text-muted">({later.length})</span>
                  </h2>
                  {laterDays.map(([d, label]) => (
                    <div key={d} className="mt-4">
                      <h3 className="text-sm font-semibold text-muted">{label}</h3>
                      <ol className="mt-2 space-y-3">{later.filter((r) => dayOf(r) === d).map(row)}</ol>
                    </div>
                  ))}
                </section>
              )}
            </>
          ) : upcoming.length > 0 ? (
            <ol className="mt-5 space-y-3">{upcoming.map(row)}</ol>
          ) : (
            <p className="mt-6 text-muted">{finished.length ? "Every meeting is marked." : "No meetings left."}</p>
          )}
          {finished.length > 0 && (
            <section className="mt-10 print:mt-6" aria-labelledby="past-meetings">
              <h2 id="past-meetings" className="text-lg font-semibold">
                Past meetings <span className="font-normal text-muted">({finished.length})</span>
              </h2>
              <p className="mt-1 text-sm text-muted print:hidden">Marked Met or No-show. Tap again to undo.</p>
              <ol className="mt-3 space-y-3">{finished.map(row)}</ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
