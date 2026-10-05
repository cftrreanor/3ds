"use client";

import { useState, useTransition, type ReactNode } from "react";
import { NumberInput } from "@/components/number-input";
import { Button, Card, Field, FormMessage, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { displayTime, formatDuration, performTimes, toMinutes, toTime, type Span } from "@/lib/schedule";
import { formatDate } from "@/lib/time";

/** A band's (or finals slot's) times, as wall-clock times on the event's days. */
type Times = {
  day: string;
  warmUp: string;
  /** Warm-up length in minutes (15-minute steps), or 0 if not set. */
  warmUpMinutes: number;
  perform: string;
  location: string;
};

export type OrderBand = Times & {
  id: string;
  name: string;
  school: string;
  classification: string;
  conflicts: string | null;
};

/** A finals slot: times now, the band once finalists are announced ("" = to be announced). */
export type FinalsSlot = Times & { bandId: string };

export type ScheduleBreak = { day: string; start: string; minutes: number; label: string };

type BreakDraft = { key: number; day: string; start: string; minutes: string; label: string };

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15); // 15 min … 4 hours
const DEFAULT_FINALISTS = 6;
const MAX_FINALISTS = 30;

let nextKey = 0;
const toDraft = (b: ScheduleBreak): BreakDraft => ({ ...b, minutes: String(b.minutes), key: nextKey++ });
const pickTimes = ({ day, warmUp, warmUpMinutes, perform, location }: Times): Times => ({ day, warmUp, warmUpMinutes, perform, location });
const blankTimes = (day: string): Times => ({ day, warmUp: "", warmUpMinutes: 0, perform: "", location: "" });

/** Breaks on one day, as minute spans, skipping any that aren't filled in yet. */
function breakSpans(breaks: BreakDraft[], day: string): (Span & { label: string })[] {
  return breaks
    .filter((b) => b.day === day && b.start && Number(b.minutes) > 0)
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.start) + Number(b.minutes), label: b.label || "Break" }))
    .sort((a, b) => a.start - b.start);
}

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
  save,
}: {
  initialBands: OrderBand[];
  initialBreaks: ScheduleBreak[];
  initialFinals: FinalsSlot[];
  initialReadyMinutes: number;
  days: string[];
  zoneLabel: string;
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

  const onSave = () =>
    startTransition(async () => {
      const r = await save(
        JSON.stringify({
          readyMinutes: readyText,
          slots: bands.map((b) => ({
            band_id: b.id,
            day: b.day,
            warmUp: b.warmUp,
            warmUpMinutes: b.warmUpMinutes,
            perform: b.perform,
            location: b.location,
          })),
          breaks: breaks.map(({ day, start, minutes, label }) => ({ day, start, minutes, label })),
          finals: finals.map((f) => ({
            band_id: f.bandId,
            day: f.day,
            warmUp: f.warmUp,
            warmUpMinutes: f.warmUpMinutes,
            perform: f.perform,
            location: f.location,
          })),
        }),
      );
      setResult(r);
      if (r.ok) setDirty(false);
    });

  if (bands.length === 0) return <p className="text-muted">No bands have registered yet.</p>;

  return (
    <div className="space-y-8">
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
  const [countText, setCountText] = useState(String(finals.length || DEFAULT_FINALISTS));
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
    return (
      <Card className="space-y-3">
        <h3 className="font-semibold">Finals</h3>
        <p className="text-sm text-muted">
          Does this contest have a finals round? Add placeholder slots now and set their times. Pick the finalist bands
          once they&apos;re announced.
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setCountText(String(DEFAULT_FINALISTS));
            onChange(Array.from({ length: DEFAULT_FINALISTS }, () => ({ ...blankTimes(lastDay), bandId: "" })));
          }}
        >
          + Add a finals round
        </Button>
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
            if (window.confirm("Remove the finals round and its times?")) onChange([]);
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

function TimesEditor({
  value: v,
  days,
  breaks,
  readyMinutes,
  onChange,
}: {
  value: Times;
  days: string[];
  breaks: BreakDraft[];
  readyMinutes: number;
  onChange: (patch: Partial<Times>) => void;
}) {
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {days.length > 1 && (
          <Field label="Day">
            <Select value={v.day} onChange={(e) => onChange({ day: e.target.value })}>
              {days.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d, { year: undefined })}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Warm-up starts">
          <Input type="time" value={v.warmUp} onChange={(e) => onChange({ warmUp: e.target.value })} />
        </Field>
        <Field label="Warm-up length">
          <Select value={v.warmUpMinutes || ""} onChange={(e) => onChange({ warmUpMinutes: Number(e.target.value) || 0 })}>
            <option value="">Not set</option>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Performs">
          <Input type="time" value={v.perform} onChange={(e) => onChange({ perform: e.target.value })} />
        </Field>
        <Field label="Warm-up location" className="col-span-2 sm:col-span-4">
          <Input value={v.location} onChange={(e) => onChange({ location: e.target.value })} />
        </Field>
      </div>
      <Timeline times={v} readyMinutes={readyMinutes} breaks={breaks} />
    </>
  );
}

/** Warm-up → ends → ready → performs, worked out from the times. */
function Timeline({ times: t, readyMinutes, breaks }: { times: Times; readyMinutes: number; breaks: BreakDraft[] }) {
  if (!t.warmUp && !t.perform) return null;
  const warmEnd = t.warmUp && t.warmUpMinutes ? toTime(toMinutes(t.warmUp) + t.warmUpMinutes) : null;
  const ready = t.perform ? toTime(toMinutes(t.perform) - readyMinutes) : null;
  const overlap = warmEnd && ready && toMinutes(warmEnd) > toMinutes(ready);
  const during = t.perform
    ? breakSpans(breaks, t.day).find((b) => toMinutes(t.perform) >= b.start && toMinutes(t.perform) < b.end)
    : undefined;
  const steps = [
    t.warmUp && ["Warm-up", displayTime(t.warmUp)],
    warmEnd && ["Warm-up ends", displayTime(warmEnd)],
    ready && ["Ready position", displayTime(ready)],
    t.perform && ["Performs", displayTime(t.perform)],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="mt-3 rounded-lg bg-background px-3 py-2 text-sm">
      <p className="flex flex-wrap gap-x-2 gap-y-1">
        {steps.map(([label, time], k) => (
          <span key={label} className="whitespace-nowrap">
            {k > 0 && <span className="mr-2 text-muted">→</span>}
            <span className="text-muted">{label}</span> <span className="font-medium">{time}</span>
          </span>
        ))}
      </p>
      {overlap && <p className="mt-1 text-danger">⚠️ Warm-up runs past the ready position.</p>}
      {during && (
        <p className="mt-1 text-danger">
          ⚠️ Performs during {during.label} ({displayTime(toTime(during.start))} – {displayTime(toTime(during.end))}).
        </p>
      )}
    </div>
  );
}

/** Shows any break that falls between the previous performance and this one, then this one. */
function BreakDividers({
  breaks,
  prev,
  cur,
  children,
}: {
  breaks: BreakDraft[];
  prev: Times | undefined;
  cur: Times;
  children: ReactNode;
}) {
  const between =
    prev && prev.perform && cur.perform && prev.day === cur.day
      ? breakSpans(breaks, cur.day).filter((b) => b.start >= toMinutes(prev.perform) && b.start < toMinutes(cur.perform))
      : [];
  return (
    <>
      {between.map((b) => (
        <li key={`${b.label}-${b.start}`} className="flex items-center gap-3 px-1 text-sm text-muted">
          <span className="h-px flex-1 bg-border" />
          <span className="whitespace-nowrap font-medium">
            ☕ {b.label} · {displayTime(toTime(b.start))} – {displayTime(toTime(b.end))}
          </span>
          <span className="h-px flex-1 bg-border" />
        </li>
      ))}
      {children}
    </>
  );
}
