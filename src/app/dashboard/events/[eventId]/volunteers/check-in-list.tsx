"use client";

import { useMemo, useOptimistic, useState, startTransition } from "react";
import { Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type RosterRow = {
  assignmentId: string;
  name: string;
  email: string;
  phone: string;
  phoneDisplay: string;
  station: string;
  shiftId: string;
  shiftLabel: string;
  startsAt: string;
  checkedIn: boolean;
};

export function CheckInList({
  rows,
  toggle,
}: {
  rows: RosterRow[];
  toggle: (assignmentId: string, checkedIn: boolean) => Promise<ActionState>;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(
    rows,
    (state, change: { id: string; checkedIn: boolean }) =>
      state.map((r) => (r.assignmentId === change.id ? { ...r, checkedIn: change.checkedIn } : r)),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? optimistic.filter((r) => [r.name, r.email, r.phone, r.station].some((v) => v.toLowerCase().includes(q)))
      : optimistic;
  }, [optimistic, query]);

  const groups = useMemo(() => {
    const map = new Map<string, RosterRow[]>();
    for (const r of filtered) map.set(r.shiftId, [...(map.get(r.shiftId) ?? []), r]);
    return [...map.values()];
  }, [filtered]);

  const checked = optimistic.filter((r) => r.checkedIn).length;

  function onToggle(r: RosterRow) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: r.assignmentId, checkedIn: !r.checkedIn });
      const result = await toggle(r.assignmentId, !r.checkedIn);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            <span className="text-2xl font-semibold tabular-nums">{checked}</span>
            <span className="text-muted"> / {optimistic.length} checked in</span>
          </p>
          <Input
            type="search"
            placeholder="Search name, phone or station"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-xs"
            aria-label="Search volunteers"
          />
        </div>
        {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      </div>

      {groups.length === 0 && <p className="mt-8 text-muted">{query ? "No one matches that search." : "No volunteers yet."}</p>}

      {groups.map((group) => (
        <section key={group[0].shiftId} className="mt-6">
          <h2 className="text-sm font-semibold">
            {group[0].station} · <span className="text-muted">{group[0].shiftLabel}</span>
          </h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
            {group.map((r) => (
              <li key={r.assignmentId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-sm text-muted">
                    <a href={`tel:${r.phone}`} className="hover:underline">{r.phoneDisplay}</a> · {r.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(r)}
                  aria-pressed={r.checkedIn}
                  className={`min-h-12 min-w-32 shrink-0 rounded-md px-4 text-sm font-semibold transition ${
                    r.checkedIn
                      ? "bg-accent-soft text-foreground ring-1 ring-accent"
                      : "bg-brand text-brand-foreground hover:opacity-90"
                  }`}
                >
                  {r.checkedIn ? "✓ Checked in" : "Check in"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
