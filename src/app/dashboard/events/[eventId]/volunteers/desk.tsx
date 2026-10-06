"use client";

import { startTransition, useMemo, useOptimistic, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Button, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type DeskVolunteer = {
  assignmentId: string;
  name: string;
  phone: string | null;
  phoneDisplay: string | null;
  email: string | null;
  walkUp: boolean;
  /** Under 18 / a student: their phone is a guardian's. */
  minor: boolean;
  /** Who signed them up, if someone else did. */
  signedUpBy: string | null;
  checkedIn: boolean;
};

export type DeskShift = {
  id: string;
  title: string;
  time: string;
  capacity: number;
  /** Has started (event day): anyone who hasn't checked in is "not here yet". */
  started: boolean;
  now: boolean;
  over: boolean;
  volunteers: DeskVolunteer[];
};

export type DeskStation = {
  id: string;
  name: string;
  /** "Parking", "Check-in point"… for stations on the bands' path. */
  kind: string | null;
  shifts: DeskShift[];
};

type AddWalkUp = (shiftId: string, overCapacity: boolean, prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * The volunteer desk: an Overview (who's not here yet, where help is needed now)
 * and a tab per station with its shifts. Check people in, add walk-ups, and
 * release no-shows' spots.
 */
export function Desk({
  stations,
  eventDay,
  toggle,
  addWalkUp,
  release,
}: {
  stations: DeskStation[];
  eventDay: boolean;
  toggle: (assignmentId: string, checkedIn: boolean) => Promise<ActionState>;
  addWalkUp: AddWalkUp;
  release: (assignmentId: string) => Promise<ActionState>;
}) {
  const [tab, setTab] = useState<string>("overview");
  const [query, setQuery] = useState("");
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

  const everyone = optimistic.flatMap((st) => st.shifts.flatMap((sh) => sh.volunteers));
  const here = everyone.filter((v) => v.checkedIn).length;

  function onToggle(v: DeskVolunteer) {
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

  // Searching looks across every station.
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? optimistic.flatMap((st) =>
            st.shifts.flatMap((sh) =>
              sh.volunteers
                .filter((v) => [v.name, v.phone ?? "", v.phoneDisplay ?? "", v.email ?? ""].some((x) => x.toLowerCase().includes(q)))
                .map((v) => ({ v, st, sh })),
            ),
          )
        : [],
    [optimistic, q],
  );

  const current = optimistic.find((s) => s.id === tab);
  const rowProps = { onToggle, release, eventDay };

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            <span className="text-2xl font-semibold tabular-nums">{here}</span>
            <span className="text-muted"> / {everyone.length} checked in</span>
          </p>
          <Input
            type="search"
            placeholder="Find someone by name or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-xs"
            aria-label="Find a volunteer"
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      {q ? (
        <section className="mt-5" aria-label="Search results">
          {matches.length === 0 ? (
            <p className="text-muted">No one matches that. Adding a walk-up? Open their station&apos;s tab.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {matches.map(({ v, st, sh }) => (
                <VolunteerRow key={v.assignmentId} v={v} shift={sh} detail={`${st.name} · ${sh.time}`} {...rowProps} />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <div role="tablist" aria-label="Stations" className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-1 border-b border-border">
              <TabButton active={tab === "overview"} onClick={() => setTab("overview")} label="Overview" sub="Who's not here yet?" />
              {optimistic.map((s) => {
                const people = s.shifts.flatMap((sh) => sh.volunteers);
                return (
                  <TabButton
                    key={s.id}
                    active={tab === s.id}
                    onClick={() => setTab(s.id)}
                    label={s.name}
                    sub={`${people.filter((v) => v.checkedIn).length}/${people.length} here`}
                  />
                );
              })}
            </div>
          </div>

          {current ? (
            <div className="mt-4 space-y-4">
              {current.shifts.length === 0 && <p className="text-sm text-muted">No shifts at this station.</p>}
              {current.shifts.map((sh) => (
                <ShiftCard key={sh.id} shift={sh} addWalkUp={addWalkUp} {...rowProps} />
              ))}
            </div>
          ) : (
            <Overview stations={optimistic} openTab={setTab} {...rowProps} />
          )}
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px flex flex-col items-start border-b-2 px-4 py-2 text-left text-sm ${
        active ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="text-xs font-normal tabular-nums text-muted">{sub}</span>
    </button>
  );
}

type RowProps = {
  onToggle: (v: DeskVolunteer) => void;
  release: (assignmentId: string) => Promise<ActionState>;
  eventDay: boolean;
};

function Overview({ stations, openTab, ...rowProps }: { stations: DeskStation[]; openTab: (id: string) => void } & RowProps) {
  const { eventDay } = rowProps;
  const notHere = stations.flatMap((st) =>
    st.shifts.filter((sh) => sh.started && !sh.over).flatMap((sh) => sh.volunteers.filter((v) => !v.checkedIn).map((v) => ({ v, st, sh }))),
  );
  const openNow = stations.flatMap((st) =>
    st.shifts.filter((sh) => sh.now && sh.volunteers.length < sh.capacity).map((sh) => ({ st, sh, gaps: sh.capacity - sh.volunteers.length })),
  );
  return (
    <div className="mt-4 space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stations.map((st) => {
          const people = st.shifts.flatMap((sh) => sh.volunteers);
          const arrived = people.filter((v) => v.checkedIn).length;
          const gaps = st.shifts.filter((sh) => !sh.over).reduce((n, sh) => n + Math.max(0, sh.capacity - sh.volunteers.length), 0);
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => openTab(st.id)}
              className="rounded-lg bg-surface px-3 py-2 text-left ring-1 ring-border hover:bg-background"
            >
              <p className="truncate text-xs text-muted">{st.name}</p>
              <p className="text-xl font-semibold tabular-nums">
                {arrived}
                <span className="text-sm font-normal text-muted"> / {people.length} here</span>
              </p>
              <p className="h-4 text-xs text-muted">{gaps ? `${gaps} open ${gaps === 1 ? "spot" : "spots"}` : ""}</p>
            </button>
          );
        })}
      </div>

      {!eventDay ? (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
          On contest day, this shows who&apos;s not here yet for shifts that have started, and where walk-ups are needed.
        </p>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold">Not here yet ({notHere.length})</h2>
            <p className="text-sm text-muted">Their shift has started. Give them a call if you need them.</p>
            {notHere.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Everyone on the current shifts is here.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
                {notHere.map(({ v, st, sh }) => (
                  <VolunteerRow key={v.assignmentId} v={v} shift={sh} detail={`${st.name} · ${sh.time}`} {...rowProps} />
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-sm font-semibold">Need help now</h2>
            <p className="text-sm text-muted">Shifts happening now with open spots: send walk-ups here.</p>
            {openNow.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Every current shift is full.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {openNow.map(({ st, sh, gaps }) => (
                  <li key={sh.id}>
                    <button
                      type="button"
                      onClick={() => openTab(st.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left hover:bg-background"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{st.name}</span>
                        <span className="block text-xs text-muted">{sh.time}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold">
                        {gaps} open · Add walk-up →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ShiftCard({ shift, addWalkUp, ...rowProps }: { shift: DeskShift; addWalkUp: AddWalkUp } & RowProps) {
  const [adding, setAdding] = useState(false);
  const here = shift.volunteers.filter((v) => v.checkedIn).length;
  const gaps = shift.capacity - shift.volunteers.length;
  const full = gaps <= 0;
  return (
    <section
      aria-label={`${shift.title}, ${shift.time}`}
      className={`overflow-hidden rounded-lg border bg-surface ${shift.now ? "border-brand ring-1 ring-brand" : "border-border"} ${
        shift.over ? "opacity-70" : ""
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 bg-background px-3 py-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="truncate">{shift.time}</span>
            {shift.now && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-foreground">Now</span>}
          </p>
          <p className="truncate text-xs text-muted">{shift.title}</p>
        </div>
        <p className="text-sm tabular-nums text-muted">
          {here} of {shift.volunteers.length} here · {shift.volunteers.length}/{shift.capacity} filled
        </p>
      </header>
      <ul className="divide-y divide-border">
        {shift.volunteers.map((v) => (
          <VolunteerRow key={v.assignmentId} v={v} shift={shift} {...rowProps} />
        ))}
        <li className="px-3 py-2">
          {adding ? (
            <WalkUpForm addWalkUp={addWalkUp} shiftId={shift.id} gaps={gaps} onDone={() => setAdding(false)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted">{full ? "Full" : `${gaps} open ${gaps === 1 ? "spot" : "spots"}`}</span>
              {!shift.over && (
                <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => setAdding(true)}>
                  + Add walk-up
                </Button>
              )}
            </div>
          )}
        </li>
      </ul>
    </section>
  );
}

function WalkUpForm({
  addWalkUp,
  shiftId,
  gaps,
  onDone,
}: {
  addWalkUp: AddWalkUp;
  shiftId: string;
  gaps: number;
  onDone: () => void;
}) {
  const [others, setOthers] = useState<{ name: string; minor: boolean }[]>([]);
  // Everyone in the group needs a spot; past that, the desk confirms adding anyway.
  const full = gaps < 1 + others.length;
  const setOther = (i: number, change: Partial<{ name: string; minor: boolean }>) =>
    setOthers((prev) => prev.map((o, j) => (j === i ? { ...o, ...change } : o)));
  return (
    <ActionForm
      action={addWalkUp.bind(null, shiftId, full)}
      onSuccess={onDone}
      confirmMessage={full ? `This shift doesn't have room for ${others.length ? "everyone" : "them"}. Add anyway?` : undefined}
      className="space-y-2"
    >
      <p className="text-sm font-medium">Add a walk-up</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="fullName" placeholder="Their name" required maxLength={200} autoComplete="off" aria-label="Their name" />
        <Input name="phone" type="tel" placeholder="Phone (optional)" maxLength={30} autoComplete="off" aria-label="Their phone (optional)" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="minor" className="h-5 w-5 accent-[var(--brand)]" />
        Under 18 or a student
      </label>
      <input type="hidden" name="companions" value={JSON.stringify(others)} />
      {others.map((o, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            value={o.name}
            onChange={(e) => setOther(i, { name: e.target.value })}
            placeholder="Their name"
            aria-label={`Person ${i + 2} name`}
            required
            maxLength={200}
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={o.minor}
              onChange={(e) => setOther(i, { minor: e.target.checked })}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            Under 18
          </label>
          <Button type="button" variant="ghost" className="min-h-9 px-2 text-xs" onClick={() => setOthers((prev) => prev.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </div>
      ))}
      {others.length < 4 && (
        <Button
          type="button"
          variant="ghost"
          className="min-h-9 px-0 text-xs text-brand"
          onClick={() => setOthers((prev) => [...prev, { name: "", minor: false }])}
        >
          + Add someone else
        </Button>
      )}
      <div className="flex gap-2">
        <SubmitButton pendingText="Adding…" className="min-h-10">
          {others.length ? `Add ${others.length + 1} & check in` : "Add & check in"}
        </SubmitButton>
        <Button type="button" variant="ghost" className="min-h-10" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}

function VolunteerRow({
  v,
  shift,
  detail,
  onToggle,
  release,
  eventDay,
}: { v: DeskVolunteer; shift: DeskShift; detail?: string } & RowProps) {
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notHereYet = eventDay && shift.started && !v.checkedIn;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {v.name}
          {v.minor && <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold ring-1 ring-border">Under 18</span>}
          {v.walkUp && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold">Walk-up</span>}
        </p>
        {v.signedUpBy && <p className="truncate text-xs text-muted">With {v.signedUpBy}</p>}
        {detail && <p className="truncate text-sm text-muted">{detail}</p>}
        <p className="truncate text-sm text-muted">
          {v.phone && (
            <>
              {v.minor && "Guardian: "}
              <a href={`tel:${v.phone}`} className="font-medium text-brand hover:underline">
                {v.phoneDisplay}
              </a>
            </>
          )}
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {notHereYet && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-9 px-2 text-xs"
            disabled={releasing}
            onClick={() => {
              if (!window.confirm(`Release ${v.name}'s spot? They'll be taken off this shift so someone else can fill it.`)) return;
              setReleasing(true);
              setError(null);
              release(v.assignmentId)
                .then((r) => r.error && setError(r.error))
                .catch(() => setError("That didn't go through. Try again."))
                .finally(() => setReleasing(false));
            }}
          >
            {releasing ? "Releasing…" : "Release spot"}
          </Button>
        )}
        <button
          type="button"
          onClick={() => onToggle(v)}
          aria-pressed={v.checkedIn}
          aria-label={v.checkedIn ? `${v.name} is checked in. Tap to undo.` : `Check in ${v.name}`}
          className={`flex min-h-12 min-w-28 flex-col items-center justify-center rounded-md px-3 text-sm font-semibold transition ${
            v.checkedIn ? "border border-success bg-surface text-foreground" : "bg-brand text-brand-foreground hover:opacity-90"
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
      </div>
    </li>
  );
}
