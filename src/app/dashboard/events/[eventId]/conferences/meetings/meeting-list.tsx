"use client";

import Link from "next/link";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import { toast } from "@/components/toaster";
import { Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { RECORDS_NOTE } from "@/lib/records";
import { ActionButton } from "../../forms";

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
      /** Its time has passed (on or after the day). */
      over: boolean;
      /** On the day: this meeting is happening now, is up next, or is over. */
      status: "now" | "next" | "past" | null;
      booking: {
        child: string;
        parents: MeetingParent[];
        mode: string | null;
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
}: {
  rows: MeetingRow[];
  booked: number;
  total: number;
  /** The one-page summary to print or save as a PDF. */
  summaryHref: string;
}) {
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
          [r.booking.child, ...r.booking.parents.flatMap((p) => [p.name, p.email, p.phone ?? ""])].some((x) => x.toLowerCase().includes(q))
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

  const row = (r: MeetingRow) =>
    r.kind === "break" ? (
      <li key={r.key} className="flex gap-4 px-3 py-1 text-sm text-muted">
        <span className="w-36 shrink-0 tabular-nums">{r.time}</span>
        <span>{r.label}</span>
      </li>
    ) : r.booking ? (
      <li
        key={r.key}
        className={`break-inside-avoid rounded-xl border shadow-card print:shadow-none ${
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
            <p className="text-lg font-semibold">{r.booking.child}</p>
            <ul className="space-y-0.5 text-sm">
              {r.booking.parents.map((p) => (
                <li key={p.email} className="flex flex-wrap gap-x-3">
                  <span className="font-medium">{p.name}</span>
                  <a href={`mailto:${p.email}`} className="text-brand hover:underline">
                    {p.email}
                  </a>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="text-brand hover:underline">
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
              aria-label={`How the meeting with ${r.booking.child}'s family went`}
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
              <div className="shrink-0 print:hidden">
                <ActionButton
                  action={r.booking.cancel}
                  variant="secondary"
                  pendingText="Canceling…"
                  confirmMessage={`Cancel the meeting with ${r.booking.child}'s family? We'll email them that you canceled, delete their details, and open the time up again.`}
                >
                  Cancel meeting
                </ActionButton>
              </div>
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
              / {total} times booked · {total - booked} open
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
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm print:hidden">
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={openTimes} onChange={(e) => setOpenTimes(e.target.checked)} className="h-4 w-4" />
            Show open times and breaks
          </label>
          {emails.length > 0 && (
            <button
              type="button"
              className="min-h-11 font-medium text-brand hover:underline"
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
          )}
          <Link href={summaryHref} className="inline-flex min-h-11 items-center font-medium text-brand hover:underline">
            Print summary
          </Link>
          <button type="button" className="min-h-11 font-medium text-brand hover:underline" onClick={() => window.print()}>
            Print full list
          </button>
        </div>
        <p className="mt-1 text-xs text-muted print:hidden">{RECORDS_NOTE}</p>
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
          {upcoming.length > 0 ? (
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
