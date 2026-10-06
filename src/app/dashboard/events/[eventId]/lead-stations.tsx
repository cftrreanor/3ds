"use client";

import { startTransition, useOptimistic, useState } from "react";
import type { ActionState } from "@/lib/action-state";

export type LeadVolunteer = {
  assignmentId: string;
  name: string;
  phone: string | null;
  phoneDisplay: string | null;
  checkedIn: boolean;
};

export type LeadShift = {
  id: string;
  title: string;
  time: string;
  capacity: number;
  /** Happening right now (event day only). */
  now: boolean;
  /** Already over (event day only). */
  over: boolean;
  volunteers: LeadVolunteer[];
};

export type LeadStation = {
  id: string;
  name: string;
  /** "Check-in stop 2 · Warm-up", if it's on the bands' path. */
  checkpoint: string | null;
  location: string | null;
  instructions: string | null;
  shifts: LeadShift[];
};

/**
 * A Section Lead's stations, one tab each, with their volunteers grouped by
 * shift. On event day, phone numbers show and the lead checks people in.
 */
export function LeadStations({
  stations,
  eventDay,
  unlockLabel,
  toggle,
}: {
  stations: LeadStation[];
  /** Contact details and check-in are open (it's event day). */
  eventDay: boolean;
  /** When they unlock, e.g. "Sat, Oct 24". */
  unlockLabel: string;
  toggle: (assignmentId: string, checkedIn: boolean) => Promise<ActionState>;
}) {
  const [tab, setTab] = useState(stations[0]?.id);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(stations, (state, change: { id: string; checkedIn: boolean }) =>
    state.map((st) => ({
      ...st,
      shifts: st.shifts.map((sh) => ({
        ...sh,
        volunteers: sh.volunteers.map((v) => (v.assignmentId === change.id ? { ...v, checkedIn: change.checkedIn } : v)),
      })),
    })),
  );
  const current = optimistic.find((s) => s.id === tab) ?? optimistic[0];
  if (!current) return null;

  const people = current.shifts.flatMap((s) => s.volunteers);
  const arrived = people.filter((v) => v.checkedIn).length;
  const open = current.shifts.reduce((n, s) => n + Math.max(0, s.capacity - s.volunteers.length), 0);

  function onToggle(v: LeadVolunteer) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: v.assignmentId, checkedIn: !v.checkedIn });
      try {
        const result = await toggle(v.assignmentId, !v.checkedIn);
        if (result.error) setError(result.error);
      } catch {
        setError("That didn't go through. Check your signal and tap again.");
      }
    });
  }

  return (
    <div>
      {optimistic.length > 1 && (
        <div role="tablist" aria-label="Your stations" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-1 border-b border-border">
            {optimistic.map((s) => {
              const n = s.shifts.reduce((k, sh) => k + sh.volunteers.length, 0);
              const active = s.id === current.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(s.id)}
                  className={`-mb-px flex flex-col items-start border-b-2 px-4 py-2 text-left text-sm ${
                    active ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  <span className="whitespace-nowrap">{s.name}</span>
                  <span className="text-xs font-normal tabular-nums text-muted">
                    {n} {n === 1 ? "volunteer" : "volunteers"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div role={optimistic.length > 1 ? "tabpanel" : undefined} className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-lg font-semibold">{current.name}</h3>
          {current.checkpoint && <span className="text-xs font-medium text-muted">{current.checkpoint}</span>}
        </div>
        {current.location && <p className="text-sm text-muted">{current.location}</p>}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label={eventDay ? "Arrived" : "Signed up"} value={eventDay ? `${arrived}` : `${people.length}`} sub={eventDay ? `of ${people.length}` : undefined} />
          <Stat label="Shifts" value={`${current.shifts.length}`} />
          <Stat label="Open spots" value={`${open}`} />
        </dl>

        {current.instructions && (
          <details className="mt-4 rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Station instructions</summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">{current.instructions}</p>
          </details>
        )}

        {!eventDay && (
          <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm">
            Phone numbers and check-in open on event day ({unlockLabel}).
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        {current.shifts.length === 0 && <p className="mt-4 text-sm text-muted">No shifts at this station yet.</p>}
        <div className="mt-4 space-y-4">
          {current.shifts.map((s) => {
            const here = s.volunteers.filter((v) => v.checkedIn).length;
            const gaps = Math.max(0, s.capacity - s.volunteers.length);
            return (
              <section
                key={s.id}
                aria-label={`${s.title}, ${s.time}`}
                className={`overflow-hidden rounded-lg border ${s.now ? "border-brand ring-1 ring-brand" : "border-border"} ${s.over ? "opacity-70" : ""}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{s.time}</span>
                      {s.now && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-foreground">Now</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{s.title}</p>
                  </div>
                  <p className="text-sm tabular-nums text-muted">
                    {eventDay ? `${here} of ${s.volunteers.length} here` : `${s.volunteers.length} of ${s.capacity} filled`}
                  </p>
                </header>
                <ul className="divide-y divide-border">
                  {s.volunteers.map((v) => (
                    <li key={v.assignmentId} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{v.name}</p>
                        {v.phone && (
                          <a href={`tel:${v.phone}`} className="text-sm font-medium text-brand hover:underline">
                            {v.phoneDisplay}
                          </a>
                        )}
                      </div>
                      {eventDay ? (
                        <button
                          type="button"
                          onClick={() => onToggle(v)}
                          aria-pressed={v.checkedIn}
                          aria-label={v.checkedIn ? `${v.name} is checked in. Tap to undo.` : `Check in ${v.name}`}
                          className={`flex min-h-11 min-w-28 shrink-0 flex-col items-center justify-center rounded-md px-3 text-sm font-semibold transition ${
                            v.checkedIn
                              ? "border border-success bg-surface text-foreground"
                              : "bg-brand text-brand-foreground hover:opacity-90"
                          }`}
                        >
                          {v.checkedIn ? (
                            <>
                              <span>✓ Here</span>
                              <span className="text-[11px] font-normal text-muted">tap to undo</span>
                            </>
                          ) : (
                            "Check in"
                          )}
                        </button>
                      ) : null}
                    </li>
                  ))}
                  {gaps > 0 && (
                    <li className="px-3 py-2 text-sm text-muted">
                      {gaps} open {gaps === 1 ? "spot" : "spots"}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-background px-2 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">
        {value}
        {sub && <span className="text-sm font-normal text-muted"> {sub}</span>}
      </dd>
    </div>
  );
}
