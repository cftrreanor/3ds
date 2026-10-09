"use client";

import { useMemo, useState, useTransition } from "react";
import { NumberInput } from "@/components/number-input";
import { Button, Card, Field, FormMessage, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { pathRooms, roomTimes, tooLongRooms, type ChoirPlan, type Room } from "@/lib/rooms";
import { formatDate, formatTime, zonedToUtc } from "@/lib/time";
import type { ScheduleInput } from "./actions";

export type ScheduleChoir = { id: string; name: string; school: string; classification: string; conflicts: string | null };

/**
 * Choirs in order. Each starts the path one interval after the one before
 * (plus any break), and every room's time follows from the room lengths and
 * the passing time, previewed here as you go.
 */
export function ScheduleEditor({
  choirs,
  rooms,
  initialOrder,
  initialDate,
  initialTime,
  initialInterval,
  initialPassing,
  days,
  timezone,
  zoneLabel,
  posted,
  save,
}: {
  choirs: ScheduleChoir[];
  rooms: Room[];
  initialOrder: ChoirPlan[];
  initialDate: string;
  initialTime: string;
  initialInterval: number;
  initialPassing: number;
  days: string[];
  timezone: string;
  zoneLabel: string;
  posted: boolean;
  save: (input: ScheduleInput) => Promise<ActionState>;
}) {
  // The saved order first, then choirs that registered since.
  const [order, setOrder] = useState<ChoirPlan[]>(() => [
    ...initialOrder.filter((o) => choirs.some((c) => c.id === o.bandId)),
    ...choirs.filter((c) => !initialOrder.some((o) => o.bandId === c.id)).map((c) => ({ bandId: c.id, skipped: [], extraMinutes: 0 })),
  ]);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [interval, setIntervalMinutes] = useState(String(initialInterval));
  const [passing, setPassing] = useState(String(initialPassing));
  const [emailChanges, setEmailChanges] = useState(true);
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();

  const path = pathRooms(rooms);
  const unsaved = initialOrder.length !== order.length || order.some((o, i) => initialOrder[i]?.bandId !== o.bandId);
  const byId = new Map(choirs.map((c) => [c.id, c]));
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const iv = Number(interval) || 0;
  const pass = Number(passing) || 0;
  const times = useMemo(
    () => (date && time ? roomTimes(zonedToUtc(date, time, timezone), iv, pass, rooms, order) : new Map()),
    [date, time, timezone, iv, pass, rooms, order],
  );
  const overlong = tooLongRooms(rooms, iv);

  const set = (i: number, patch: Partial<ChoirPlan>) => setOrder((list) => list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const move = (i: number, by: number) =>
    setOrder((list) => {
      const next = [...list];
      const [o] = next.splice(i, 1);
      next.splice(i + by, 0, o);
      return next;
    });

  if (!path.length) {
    return (
      <Card>
        <p className="text-muted">Add the rooms every choir visits (above) first; then put the choirs in order here.</p>
      </Card>
    );
  }
  if (!choirs.length) {
    return (
      <Card>
        <p className="text-muted">No choirs have registered yet. They&apos;ll appear here, ready to put in order.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Day">
            <Select value={date} onChange={(e) => setDate(e.target.value)}>
              {days.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d, { year: undefined })}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="First choir starts">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Minutes between choirs">
            <NumberInput value={interval} onChange={(e) => setIntervalMinutes(e.target.value)} maxLength={3} />
          </Field>
          <Field label="Passing time (minutes)" hint="Walking between rooms.">
            <NumberInput value={passing} onChange={(e) => setPassing(e.target.value)} maxLength={2} />
          </Field>
        </div>
        <p className="text-sm text-muted">
          Path: {path.map((r) => `${r.name} (${r.minutes} min)`).join(" → ")}. All times {zoneLabel}.
        </p>
        {overlong.length > 0 && (
          <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm" role="alert">
            {overlong.map((r) => r.name).join(" and ")} {overlong.length === 1 ? "takes" : "take"} longer than the {iv} minutes
            between choirs, so two choirs would be in {overlong.length === 1 ? "it" : "them"} at once. Make the gap at least{" "}
            {Math.max(...overlong.map((r) => r.minutes))} minutes.
          </p>
        )}
      </Card>

      <ol className="space-y-3">
        {order.map((o, i) => {
          const c = byId.get(o.bandId);
          if (!c) return null;
          const mine = times.get(o.bandId) ?? [];
          return (
            <li key={o.bandId}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                      {c.name}
                    </p>
                    <p className="text-sm text-muted">
                      {c.school} · {c.classification}
                    </p>
                    {c.conflicts && <p className="mt-1 text-sm">⚠️ {c.conflicts}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" className="min-h-9 px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} earlier`}>
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-9 px-2"
                      disabled={i === order.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label={`Move ${c.name} later`}
                    >
                      ↓
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {path.map((r) => {
                    const t = mine.find((x: { roomId: string }) => x.roomId === r.id);
                    const skipped = o.skipped.includes(r.id);
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => set(i, { skipped: skipped ? o.skipped.filter((x) => x !== r.id) : [...o.skipped, r.id] })}
                          aria-pressed={!skipped}
                          title={skipped ? `Add ${r.name} back` : `Skip ${r.name} for this choir`}
                          className={`flex min-h-11 flex-col items-start rounded-md border px-3 py-1 text-left text-sm ${skipped ? "border-dashed border-border text-muted line-through" : "border-border bg-background"}`}
                        >
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs tabular-nums">{skipped ? "Skipping" : t ? `${formatTime(t.startsAt.toISOString(), timezone)}–${formatTime(t.endsAt.toISOString(), timezone)}` : ""}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <label htmlFor={`break-${o.bandId}`} className="text-muted">
                    Break before this choir
                  </label>
                  <div className="w-20">
                    <NumberInput
                      id={`break-${o.bandId}`}
                      value={o.extraMinutes ? String(o.extraMinutes) : ""}
                      onChange={(e) => set(i, { extraMinutes: Number(e.target.value) || 0 })}
                      placeholder="0"
                      maxLength={3}
                    />
                  </div>
                  <span className="text-muted">min</span>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted">Tap a room to skip it for that choir (for example, a choir not sight-reading).</p>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <FormMessage error={state.error} success={state.ok ? state.message : null} />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setState(
                  await save({
                    date,
                    time,
                    interval: iv,
                    passing: pass,
                    order: order.map((o) => ({ bandId: o.bandId, skipped: o.skipped.filter((id) => roomName.has(id)), extraMinutes: o.extraMinutes })),
                    emailChanges,
                  }),
                );
              })
            }
          >
            {pending ? "Saving…" : "Save schedule"}
          </Button>
          {posted && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={emailChanges} onChange={(e) => setEmailChanges(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
              Email directors whose times change
            </label>
          )}
          {unsaved && !pending && <span className="text-sm text-muted">New choirs aren&apos;t scheduled until you save.</span>}
        </div>
      </div>
    </div>
  );
}
