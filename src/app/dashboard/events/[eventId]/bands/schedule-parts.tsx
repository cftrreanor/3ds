"use client";

import type { ReactNode } from "react";
import { Field, Input, Select } from "@/components/ui";
import { displayTime, formatDuration, toMinutes, toTime, type Span } from "@/lib/schedule";
import { formatDate } from "@/lib/time";

// Pieces shared by the schedule builder (editing) and the schedule view
// (published, read-only with per-band edits).

/** A band's (or finals slot's) times, as wall-clock times on the event's days. */
export type Times = {
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

export type BreakDraft = { key: number; day: string; start: string; minutes: string; label: string };

export const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15); // 15 min … 4 hours
/** Breaks on one day, as minute spans, skipping any that aren't filled in yet. */
export function breakSpans(breaks: BreakDraft[], day: string): (Span & { label: string })[] {
  return breaks
    .filter((b) => b.day === day && b.start && Number(b.minutes) > 0)
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.start) + Number(b.minutes), label: b.label || "Break" }))
    .sort((a, b) => a.start - b.start);
}

export function TimesEditor({
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
export function Timeline({ times: t, readyMinutes, breaks }: { times: Times; readyMinutes: number; breaks: BreakDraft[] }) {
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
export function BreakDividers({
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
