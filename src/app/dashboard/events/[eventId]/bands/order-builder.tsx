"use client";

import { useState, useTransition } from "react";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/time";

export type OrderBand = {
  id: string;
  name: string;
  school: string;
  classification: string;
  conflicts: string | null;
  day: string;
  warmUp: string;
  perform: string;
  location: string;
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Drag-free running-order editor: big up/down buttons work well on phones and for keyboard users. */
export function OrderBuilder({
  initial,
  days,
  save,
  zoneLabel,
}: {
  initial: OrderBand[];
  days: string[];
  save: (slotsJson: string) => Promise<ActionState>;
  zoneLabel: string;
}) {
  const [bands, setBands] = useState(initial);
  const [result, setResult] = useState<ActionState>({});
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [auto, setAuto] = useState({ day: days[0], first: "09:00", slot: 15, warmUp: 60, location: "" });

  const update = (next: OrderBand[]) => {
    setBands(next);
    setDirty(true);
    setResult({});
  };
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= bands.length) return;
    const next = [...bands];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const edit = (i: number, patch: Partial<OrderBand>) => update(bands.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  const autofill = () =>
    update(
      bands.map((b, i) => {
        const perform = toMinutes(auto.first) + i * auto.slot;
        return {
          ...b,
          day: auto.day,
          perform: toTime(perform),
          warmUp: toTime(perform - auto.warmUp),
          location: auto.location || b.location,
        };
      }),
    );

  if (bands.length === 0) return <p className="text-muted">No bands have registered yet.</p>;

  return (
    <div className="space-y-6">
      <details className="rounded-lg border border-border bg-surface px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Fill in times automatically</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {days.length > 1 && (
            <Field label="Day">
              <Select value={auto.day} onChange={(e) => setAuto({ ...auto, day: e.target.value })}>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {formatDate(d)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={`First performance (${zoneLabel})`}>
            <Input type="time" value={auto.first} onChange={(e) => setAuto({ ...auto, first: e.target.value })} />
          </Field>
          <Field label="Minutes between bands">
            <Input type="number" min={1} max={120} value={auto.slot} onChange={(e) => setAuto({ ...auto, slot: Number(e.target.value) || 15 })} />
          </Field>
          <Field label="Warm-up starts (minutes before)">
            <Input type="number" min={0} max={240} value={auto.warmUp} onChange={(e) => setAuto({ ...auto, warmUp: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Warm-up location" hint="Optional. Leave blank to keep each band's.">
            <Input value={auto.location} onChange={(e) => setAuto({ ...auto, location: e.target.value })} placeholder="e.g. Practice field B" />
          </Field>
        </div>
        <Button type="button" variant="secondary" className="mt-4" onClick={autofill}>
          Fill in times for all {bands.length} bands
        </Button>
      </details>

      <ol className="space-y-3">
        {bands.map((b, i) => (
          <li key={b.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{b.name}</p>
                <p className="text-sm text-muted">
                  {b.school} · {b.classification}
                </p>
                {b.conflicts && <p className="mt-1 text-sm">⚠️ {b.conflicts}</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button type="button" variant="secondary" className="min-h-9 px-3" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${b.name} earlier`}>
                  ↑
                </Button>
                <Button type="button" variant="secondary" className="min-h-9 px-3" onClick={() => move(i, 1)} disabled={i === bands.length - 1} aria-label={`Move ${b.name} later`}>
                  ↓
                </Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {days.length > 1 && (
                <Field label="Day">
                  <Select value={b.day} onChange={(e) => edit(i, { day: e.target.value })}>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {formatDate(d, { year: undefined })}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Warm-up">
                <Input type="time" value={b.warmUp} onChange={(e) => edit(i, { warmUp: e.target.value })} />
              </Field>
              <Field label="Performs">
                <Input type="time" value={b.perform} onChange={(e) => edit(i, { perform: e.target.value })} />
              </Field>
              <Field label="Warm-up location" className={days.length > 1 ? "" : "col-span-2"}>
                <Input value={b.location} onChange={(e) => edit(i, { location: e.target.value })} />
              </Field>
            </div>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <FormMessage error={result.error} success={result.ok ? result.message : null} />
        <Button
          type="button"
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              const r = await save(
                JSON.stringify(
                  bands.map((b) => ({ band_id: b.id, day: b.day, warmUp: b.warmUp, perform: b.perform, location: b.location })),
                ),
              );
              setResult(r);
              if (r.ok) setDirty(false);
            })
          }
        >
          {pending ? "Saving…" : dirty ? "Save order & times" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
