"use client";

import { useState, useTransition, type ReactNode } from "react";
import { NumberInput } from "@/components/number-input";
import { Button, Card, Field, FormMessage, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatDuration, performTimes, toMinutes, toTime } from "@/lib/schedule";
import { formatDate } from "@/lib/time";
import {
  BreakDividers,
  breakSpans,
  DURATIONS,
  TimesEditor,
  type BreakDraft,
  type FinalsSlot,
  type OrderBand,
  type ScheduleBreak,
  type Times,
} from "./schedule-parts";
import { ScheduleView, type RowEdit } from "./schedule-view";

export type { FinalsSlot, OrderBand, ScheduleBreak };

const MAX_FINALISTS = 30;

let nextKey = 0;
const toDraft = (b: ScheduleBreak): BreakDraft => ({ ...b, minutes: String(b.minutes), key: nextKey++ });
const pickTimes = ({ day, warmUp, warmUpMinutes, perform, location }: Times): Times => ({ day, warmUp, warmUpMinutes, perform, location });
const blankTimes = (day: string): Times => ({ day, warmUp: "", warmUpMinutes: 0, perform: "", location: "" });

/**
 * The host's whole performance schedule: breaks, the running order and an
 * optional finals round, saved together. Drag-free: big up/down buttons work
 * well on phones and for keyboard users.
 */
export function ScheduleBuilder({
  initialBands,
  initialBreaks,
  initialFinals,
  initialReadyMinutes,
  days,
  zoneLabel,
  orderPublished,
  finalsPublished,
  save,
}: {
  initialBands: OrderBand[];
  initialBreaks: ScheduleBreak[];
  initialFinals: FinalsSlot[];
  initialReadyMinutes: number;
  days: string[];
  zoneLabel: string;
  orderPublished: boolean;
  finalsPublished: boolean;
  save: (scheduleJson: string) => Promise<ActionState>;
}) {
  const [bands, setBands] = useState(initialBands);
  const [breaks, setBreaks] = useState(() => initialBreaks.map(toDraft));
  const [finals, setFinals] = useState(initialFinals);
  // Typed number boxes keep their text so they can be cleared while typing.
  const [readyText, setReadyText] = useState(String(initialReadyMinutes));
  const readyMinutes = Number(readyText) || 0;
  const [result, setResult] = useState<ActionState>({});
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  // Once anything is published, start on the read-only view; the full builder
  // is one tap away. Before that, the builder is the page.
  const published = orderPublished || finalsPublished;
  const [mode, setMode] = useState<"view" | "edit">(published ? "view" : "edit");
  // The last saved schedule, to put back if the host leaves the editor without saving.
  const [saved, setSaved] = useState(() => ({ bands: initialBands, breaks: initialBreaks.map(toDraft), finals: initialFinals, readyText: String(initialReadyMinutes) }));

  const changed = () => {
    setDirty(true);
    setResult({});
  };
  const updateBands = (next: OrderBand[]) => {
    setBands(next);
    changed();
  };
  const updateFinals = (next: FinalsSlot[]) => {
    setFinals(next);
    changed();
  };
  const updateBreaks = (next: BreakDraft[]) => {
    setBreaks(next);
    changed();
  };
  const onReadyText = (v: string) => {
    setReadyText(v);
    changed();
  };

  // Moving a band carries its times with it. The slot times from before the
  // first move are kept so "Update schedule" can give each position its time
  // and warm-up location back, in the new order. null = nothing to update.
  const [before, setBefore] = useState<{ ids: string[]; slots: Times[] } | null>(null);
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= bands.length) return;
    const next = [...bands];
    [next[i], next[j]] = [next[j], next[i]];
    const base = before ?? { ids: bands.map((b) => b.id), slots: bands.map(pickTimes) };
    // Moved back to where it started: nothing left to update.
    setBefore(next.every((b, k) => b.id === base.ids[k]) ? null : base);
    updateBands(next);
  };
  const updateSchedule = () => {
    if (!before) return;
    updateBands(bands.map((b, i) => ({ ...b, ...before.slots[i] })));
    setBefore(null);
  };
  const updateButton = (
    <Button type="button" variant={before ? "accent" : "secondary"} disabled={!before} onClick={updateSchedule}>
      Update schedule
    </Button>
  );
  const editBand = (i: number, patch: Partial<OrderBand>) => updateBands(bands.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  const editFinal = (i: number, patch: Partial<FinalsSlot>) => updateFinals(finals.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  type Snapshot = typeof saved;
  const toJson = (x: Snapshot) =>
    JSON.stringify({
      readyMinutes: x.readyText,
      slots: x.bands.map((b) => ({
        band_id: b.id,
        day: b.day,
        warmUp: b.warmUp,
        warmUpMinutes: b.warmUpMinutes,
        perform: b.perform,
        location: b.location,
      })),
      breaks: x.breaks.map(({ day, start, minutes, label }) => ({ day, start, minutes, label })),
      finals: x.finals.map((f) => ({
        band_id: f.bandId,
        day: f.day,
        warmUp: f.warmUp,
        warmUpMinutes: f.warmUpMinutes,
        perform: f.perform,
        location: f.location,
      })),
    });
  const persist = (x: Snapshot) =>
    new Promise<boolean>((resolve) =>
      startTransition(async () => {
        const r = await save(toJson(x));
        setResult(r);
        if (r.ok) {
          setSaved(x);
          setDirty(false);
        }
        resolve(Boolean(r.ok));
      }),
    );
  const onSave = () => persist({ bands, breaks, finals, readyText });

  // One band (or finals slot) changed from the view, optionally moving the
  // timed bands after it on the same day by the same amount.
  const saveRow = async ({ round, index, times, bandId, shiftLater }: RowEdit) => {
    const list: Times[] = round === "order" ? bands : finals;
    const old = list[index];
    const delta = shiftLater && old.perform && times.perform ? toMinutes(times.perform) - toMinutes(old.perform) : 0;
    const shift = (t: string) => (t ? toTime(toMinutes(t) + delta) : t);
    const apply = <T extends Times>(rows: T[]): T[] =>
      rows.map((r, k) =>
        k === index
          ? { ...r, ...times }
          : delta && k > index && r.day === old.day && r.perform
            ? { ...r, perform: shift(r.perform), warmUp: shift(r.warmUp) }
            : r,
      );
    const next =
      round === "order"
        ? { bands: apply(bands), breaks, finals, readyText }
        : { bands, breaks, readyText, finals: apply(finals).map((f, k) => (k === index && bandId !== undefined ? { ...f, bandId } : f)) };
    const ok = await persist(next);
    if (ok) {
      setBands(next.bands);
      setFinals(next.finals);
    }
    return ok;
  };

  const leaveEditor = () => {
    if (dirty && !window.confirm("Discard the changes you haven't saved?")) return;
    setBands(saved.bands);
    setBreaks(saved.breaks);
    setFinals(saved.finals);
    setReadyText(saved.readyText);
    setBefore(null);
    setDirty(false);
    setResult({});
    setMode("view");
  };

  if (bands.length === 0) return <p className="text-muted">No bands have registered yet.</p>;

  if (mode === "view") {
    return (
      <div className="space-y-4">
        <FormMessage error={result.error} success={result.ok ? result.message : null} />
        <ScheduleView
          bands={bands}
          finals={finals}
          breaks={breaks}
          readyMinutes={readyMinutes}
          days={days}
          orderPublished={orderPublished}
          finalsPublished={finalsPublished}
          pending={pending}
          onEditAll={() => {
            setResult({});
            setMode("edit");
          }}
          onSaveRow={saveRow}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {published && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-3">
          <p className="text-sm font-medium">Editing the full schedule. It&apos;s published, so saved changes go live right away.</p>
          <Button type="button" variant="secondary" onClick={leaveEditor}>
            Done
          </Button>
        </div>
      )}
      <BreaksEditor breaks={breaks} days={days} zoneLabel={zoneLabel} onChange={updateBreaks} />

      <div className="space-y-6">
        <h3 className="text-base font-semibold">Running order</h3>
        <AutoFill
          title="Fill in times automatically"
          noun={bands.length === 1 ? "band" : "bands"}
          count={bands.length}
          days={days}
          defaultDay={days[0]}
          defaultFirst="09:00"
          zoneLabel={zoneLabel}
          breaks={breaks}
          readyText={readyText}
          onReadyText={onReadyText}
          onFill={(times) => {
            updateBands(bands.map((b, i) => ({ ...b, ...times[i] })));
            setBefore(null);
          }}
          extraAction={updateButton}
        />
        <ol className="space-y-3">
          {bands.map((b, i) => (
            <BreakDividers key={b.id} breaks={breaks} prev={bands[i - 1]} cur={b}>
              <li className="rounded-xl border border-border bg-surface p-4">
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
                <TimesEditor value={b} days={days} breaks={breaks} readyMinutes={readyMinutes} onChange={(patch) => editBand(i, patch)} />
              </li>
            </BreakDividers>
          ))}
        </ol>
      </div>

      <FinalsEditor
        finals={finals}
        bands={bands}
        days={days}
        zoneLabel={zoneLabel}
        breaks={breaks}
        readyText={readyText}
        readyMinutes={readyMinutes}
        onReadyText={onReadyText}
        onChange={updateFinals}
        onEdit={editFinal}
      />

      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        {before && (
          <p className="text-sm">You moved bands. Their times moved with them. Update the schedule to re-time the new order.</p>
        )}
        <FormMessage error={result.error} success={result.ok ? result.message : null} />
        <div className="flex flex-wrap gap-3">
          {updateButton}
          <Button type="button" disabled={pending || !dirty} onClick={onSave}>
            {pending ? "Saving…" : dirty ? "Save schedule" : "Saved"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BreaksEditor({
  breaks,
  days,
  zoneLabel,
  onChange,
}: {
  breaks: BreakDraft[];
  days: string[];
  zoneLabel: string;
  onChange: (next: BreakDraft[]) => void;
}) {
  const edit = (key: number, patch: Partial<BreakDraft>) => onChange(breaks.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const add = () =>
    onChange([
      ...breaks,
      { key: nextKey++, day: breaks.at(-1)?.day ?? days[0], start: "12:00", minutes: "30", label: breaks.length ? "Break" : "Lunch" },
    ]);
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-semibold">Breaks</h3>
        <p className="mt-1 text-sm text-muted">
          Lunch, judges&apos; breaks, awards. Filling in times automatically skips over them, and they show on the public
          schedule between bands.
        </p>
      </div>
      {breaks.length > 0 && (
        <ul className="space-y-3">
          {breaks.map((b) => (
            <li key={b.key} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
              {days.length > 1 && (
                <Field label="Day">
                  <Select value={b.day} onChange={(e) => edit(b.key, { day: e.target.value })}>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {formatDate(d, { year: undefined })}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={`Starts (${zoneLabel})`}>
                <Input type="time" required value={b.start} onChange={(e) => edit(b.key, { start: e.target.value })} />
              </Field>
              <Field label="Minutes">
                <NumberInput maxLength={3} value={b.minutes} onChange={(e) => edit(b.key, { minutes: e.target.value })} />
              </Field>
              <Field label="Name" className={days.length > 1 ? "" : "sm:col-span-2"}>
                <Input value={b.label} maxLength={80} onChange={(e) => edit(b.key, { label: e.target.value })} placeholder="e.g. Lunch" />
              </Field>
              <Button type="button" variant="danger" onClick={() => onChange(breaks.filter((x) => x.key !== b.key))} aria-label={`Remove ${b.label || "break"}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="secondary" onClick={add}>
        + Add a break
      </Button>
    </Card>
  );
}

/** The "fill in times automatically" panel, for the running order or the finals. */
function AutoFill({
  title,
  noun,
  count,
  days,
  defaultDay,
  defaultFirst,
  zoneLabel,
  breaks,
  readyText,
  onReadyText,
  onFill,
  extraAction,
}: {
  title: string;
  /** What's being filled, e.g. "bands" or "finals slots". */
  noun: string;
  count: number;
  days: string[];
  defaultDay: string;
  defaultFirst: string;
  zoneLabel: string;
  breaks: BreakDraft[];
  readyText: string;
  onReadyText: (v: string) => void;
  onFill: (times: Partial<Times>[]) => void;
  /** Another button shown next to "Fill in times". */
  extraAction?: ReactNode;
}) {
  const [auto, setAuto] = useState({ day: defaultDay, first: defaultFirst, slot: "15", warmUp: "60", duration: 45, location: "" });
  const slot = Number(auto.slot) || 15;
  const warmUp = Number(auto.warmUp) || 0;
  const readyMinutes = Number(readyText) || 0;
  // "Field A, Field B" alternates between the listed locations, band by band.
  const locations = auto.location
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  const dayBreaks = breakSpans(breaks, auto.day);

  const fill = () =>
    onFill(
      performTimes(count, toMinutes(auto.first), slot, dayBreaks).map((perform, i) => ({
        day: auto.day,
        perform: toTime(perform),
        warmUp: toTime(perform - warmUp),
        warmUpMinutes: auto.duration,
        ...(locations.length ? { location: locations[i % locations.length] } : {}),
      })),
    );

  return (
    <details open className="rounded-lg border border-border bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
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
        <Field
          label="Minutes between bands"
          hint={dayBreaks.length ? `Skips ${dayBreaks.map((b) => b.label).join(", ")}.` : undefined}
        >
          <NumberInput maxLength={3} value={auto.slot} onChange={(e) => setAuto({ ...auto, slot: e.target.value })} />
        </Field>
        <Field label="Warm-up starts (minutes before performing)">
          <NumberInput maxLength={3} value={auto.warmUp} onChange={(e) => setAuto({ ...auto, warmUp: e.target.value })} />
        </Field>
        <Field
          label="Warm-up duration"
          hint={
            auto.duration > warmUp - readyMinutes
              ? `⚠️ That runs past the ready position (${readyMinutes} min before performing).`
              : `Leaves ${warmUp - auto.duration - readyMinutes} min to reach the ready position.`
          }
        >
          <Select value={auto.duration} onChange={(e) => setAuto({ ...auto, duration: Number(e.target.value) })}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ready position (minutes before performing)" hint="Same for every band and the finals, 0 to 60. Saved with the schedule.">
          <NumberInput maxLength={2} value={readyText} onChange={(e) => onReadyText(e.target.value)} />
        </Field>
        <Field
          label="Warm-up location"
          hint={
            locations.length > 1
              ? `Bands alternate: ${locations.join(" → ")} → ${locations[0]}…`
              : "Optional. Separate several with commas to alternate bands between them. Leave blank to keep each band's."
          }
        >
          <Input
            value={auto.location}
            onChange={(e) => setAuto({ ...auto, location: e.target.value })}
            placeholder="e.g. Practice Field A, Practice Field B"
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={fill}>
          Fill in times for all {count} {noun}
        </Button>
        {extraAction}
      </div>
    </details>
  );
}

function FinalsEditor({
  finals,
  bands,
  days,
  zoneLabel,
  breaks,
  readyText,
  readyMinutes,
  onReadyText,
  onChange,
  onEdit,
}: {
  finals: FinalsSlot[];
  bands: OrderBand[];
  days: string[];
  zoneLabel: string;
  breaks: BreakDraft[];
  readyText: string;
  readyMinutes: number;
  onReadyText: (v: string) => void;
  onChange: (next: FinalsSlot[]) => void;
  onEdit: (i: number, patch: Partial<FinalsSlot>) => void;
}) {
  const [countText, setCountText] = useState(finals.length ? String(finals.length) : "");
  const lastDay = days.at(-1)!;
  const blank = (): FinalsSlot => ({ ...blankTimes(finals.at(-1)?.day ?? lastDay), bandId: "" });

  // Resize when the host finishes typing, so typing "12" doesn't first cut the list to 1.
  const applyCount = () => {
    const n = Math.min(Math.max(Number(countText) || 0, 1), MAX_FINALISTS);
    setCountText(String(n));
    if (n === finals.length) return;
    const dropped = finals.slice(n).filter((f) => f.bandId || f.perform).length;
    if (dropped && !window.confirm(`Remove the last ${finals.length - n} finals slot(s) and their times?`)) {
      setCountText(String(finals.length));
      return;
    }
    onChange(n < finals.length ? finals.slice(0, n) : [...finals, ...Array.from({ length: n - finals.length }, blank)]);
  };

  if (finals.length === 0) {
    const validCount = Number(countText) >= 1 && Number(countText) <= MAX_FINALISTS;
    const addRound = () => onChange(Array.from({ length: Number(countText) }, () => ({ ...blankTimes(lastDay), bandId: "" })));
    return (
      <Card className="space-y-3">
        <h3 className="font-semibold">Finals</h3>
        <p className="text-sm text-muted">
          Does this contest have a finals round? Choose how many bands advance, then set the slot times. Pick the finalist bands
          once they&apos;re announced.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={`Number of finalists (1–${MAX_FINALISTS})`} className="w-56">
            <NumberInput
              maxLength={2}
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (validCount) addRound();
                }
              }}
              placeholder="e.g. 6"
            />
          </Field>
          <Button type="button" variant="secondary" disabled={!validCount} onClick={addRound}>
            + Add a finals round
          </Button>
        </div>
      </Card>
    );
  }

  const taken = new Set(finals.map((f) => f.bandId).filter(Boolean));
  const named = finals.filter((f) => f.bandId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Finals</h3>
          <p className="mt-1 text-sm text-muted">
            {named === 0
              ? "Finalists show as “to be announced” until you pick them."
              : `${named} of ${finals.length} finalists picked.`}
          </p>
        </div>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            if (window.confirm("Remove the finals round and its times?")) {
              setCountText("");
              onChange([]);
            }
          }}
        >
          Remove finals
        </Button>
      </div>
      <Field label="Number of finalists" className="max-w-xs" hint={`1 to ${MAX_FINALISTS}.`}>
        <NumberInput
          maxLength={2}
          value={countText}
          onChange={(e) => setCountText(e.target.value)}
          onBlur={applyCount}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyCount();
            }
          }}
        />
      </Field>
      <AutoFill
        title="Fill in finals times automatically"
        noun={finals.length === 1 ? "finals slot" : "finals slots"}
        count={finals.length}
        days={days}
        defaultDay={finals[0].day || lastDay}
        defaultFirst="18:00"
        zoneLabel={zoneLabel}
        breaks={breaks}
        readyText={readyText}
        onReadyText={onReadyText}
        onFill={(times) => onChange(finals.map((f, i) => ({ ...f, ...times[i] })))}
      />
      <ol className="space-y-3">
        {finals.map((f, i) => (
          <BreakDividers key={i} breaks={breaks} prev={finals[i - 1]} cur={f}>
            <li className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-[#14213d]">
                  F{i + 1}
                </span>
                <Field label={`Finalist ${i + 1}`} className="min-w-0 flex-1">
                  <Select value={f.bandId} onChange={(e) => onEdit(i, { bandId: e.target.value })}>
                    <option value="">To be announced</option>
                    {bands.map((b) => (
                      <option key={b.id} value={b.id} disabled={taken.has(b.id) && b.id !== f.bandId}>
                        {b.name} ({b.school})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <TimesEditor value={f} days={days} breaks={breaks} readyMinutes={readyMinutes} onChange={(patch) => onEdit(i, patch)} />
            </li>
          </BreakDividers>
        ))}
      </ol>
    </div>
  );
}
