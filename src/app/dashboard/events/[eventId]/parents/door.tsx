"use client";

import { startTransition, useMemo, useOptimistic, useState } from "react";
import { Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type DoorParent = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phoneDisplay: string | null;
  children: { name: string; teacher: string; grade: string }[];
  adults: number;
  checkedIn: boolean;
};

/** The door: find a parent, look at their photo ID, check them in. */
export function Door({
  parents,
  toggle,
}: {
  parents: DoorParent[];
  toggle: (id: string, checkedIn: boolean) => Promise<ActionState>;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(parents, (state, change: { id: string; checkedIn: boolean }) =>
    state.map((p) => (p.id === change.id ? { ...p, checkedIn: change.checkedIn } : p)),
  );
  const here = optimistic.filter((p) => p.checkedIn).length;
  const adultsHere = optimistic.filter((p) => p.checkedIn).reduce((n, p) => n + p.adults, 0);
  const adults = optimistic.reduce((n, p) => n + p.adults, 0);

  function onToggle(p: DoorParent) {
    if (p.checkedIn && !window.confirm(`Undo ${p.name}'s check-in?`)) return;
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: p.id, checkedIn: !p.checkedIn });
      try {
        const result = await toggle(p.id, !p.checkedIn);
        if (result.error) setError(result.error);
      } catch {
        setError("That didn't go through. Check your signal and tap again.");
      }
    });
  }

  // Parents' and children's names, teachers, email and phone.
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      q
        ? optimistic.filter((p) =>
            [p.name, p.email, p.phone ?? "", p.phoneDisplay ?? "", ...p.children.flatMap((c) => [c.name, c.teacher])].some((x) =>
              x.toLowerCase().includes(q),
            ),
          )
        : optimistic,
    [optimistic, q],
  );

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            <span className="text-2xl font-semibold tabular-nums">{here}</span>
            <span className="text-muted"> / {optimistic.length} families checked in</span>
            <span className="block text-xs text-muted">
              {adultsHere} of {adults} adults
            </span>
          </p>
          <Input
            type="search"
            placeholder="Parent, child or teacher"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-xs"
            aria-label="Find a parent"
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      {optimistic.length === 0 ? (
        <p className="mt-6 text-muted">No one has registered yet.</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-muted">
          No one matches that. Not registered? They need to go through the school&apos;s visitor process instead.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border rounded-xl border border-border bg-surface shadow-card">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {p.name}
                  {p.adults > 1 && (
                    <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold ring-1 ring-warning/40">
                      {p.adults} adults · {p.adults} IDs
                    </span>
                  )}
                </p>
                <ul className="mt-0.5 text-sm">
                  {p.children.map((c, i) => (
                    <li key={i}>
                      {c.name} <span className="text-muted">· {c.grade} · {c.teacher}</span>
                    </li>
                  ))}
                </ul>
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="text-sm font-medium text-brand hover:underline">
                    {p.phoneDisplay}
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => onToggle(p)}
                aria-pressed={p.checkedIn}
                aria-label={p.checkedIn ? `${p.name} is checked in. Tap to undo.` : `ID checked: check in ${p.name}${p.adults > 1 ? ` and ${p.adults - 1} more` : ""}`}
                className={`flex min-h-12 min-w-36 shrink-0 flex-col items-center justify-center rounded-md px-3 text-sm font-semibold transition ${
                  p.checkedIn ? "border border-success bg-surface text-foreground" : "bg-brand text-brand-foreground hover:opacity-90"
                }`}
              >
                {p.checkedIn ? (
                  <>
                    <span>✓ Checked in</span>
                    <span className="text-[11px] font-normal text-muted">tap to undo</span>
                  </>
                ) : (
                  <>
                    <span>Check in</span>
                    <span className="text-[11px] font-normal opacity-80">photo ID checked</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
