"use client";

import { useState, type ReactNode } from "react";
import { Button, Field, Select } from "@/components/ui";
import { displayTime, toMinutes, toTime } from "@/lib/schedule";
import { formatDate } from "@/lib/time";
import { BreakDividers, TimesEditor, type BreakDraft, type OrderBand, type Times } from "./schedule-parts";

/** One row of a round in the view: a band in the preliminaries, or a finals slot. */
export type Row = { key: string; number: string; title: string; subtitle: string; conflicts: string | null; times: Times };

/**
 * A published (or saved) round, read-only: tap a row for its details and to
 * edit just that row; tap a break to edit it. Saving happens in the footer.
 */
export function RoundRows({
  rows,
  breaks,
  readyMinutes,
  days,
  editIndex,
  rowEditor,
  canEdit,
  onEditRow,
  onOpenBreak,
  openBreakKey,
  breakEditor,
}: {
  rows: Row[];
  breaks: BreakDraft[];
  readyMinutes: number;
  days: string[];
  /** The row being edited, if any (its editor replaces its details). */
  editIndex: number | null;
  rowEditor: ReactNode;
  /** False while something else is being edited: one thing at a time. */
  canEdit: boolean;
  onEditRow: (index: number) => void;
  onOpenBreak?: (key: number) => void;
  openBreakKey: number | null;
  breakEditor: ReactNode;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (rows.length === 0) return null;
  return (
    <ol className="mt-3 space-y-2">
      {rows.map((r, i) => {
        const editing = editIndex === i;
        const open = editing || openKey === r.key;
        return (
          <BreakDividers
            key={r.key}
            breaks={breaks}
            prev={rows[i - 1]?.times}
            cur={r.times}
            onOpenBreak={canEdit ? onOpenBreak : undefined}
            openBreakKey={openBreakKey}
            breakEditor={breakEditor}
          >
            <li className={`rounded-xl border bg-surface ${open ? "border-brand" : "border-border"}`}>
              <button
                type="button"
                onClick={() => !editing && setOpenKey(openKey === r.key ? null : r.key)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="w-8 shrink-0 text-center text-sm font-semibold text-muted">{r.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="block truncate text-sm text-muted">
                    {r.times.warmUp ? `Warm-up ${displayTime(r.times.warmUp)}${r.times.location ? ` · ${r.times.location}` : ""}` : r.subtitle}
                  </span>
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums">{r.times.perform ? displayTime(r.times.perform) : "TBA"}</span>
                <span aria-hidden="true" className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
              {open && (
                <div className="border-t border-border px-4 py-4">
                  {editing ? (
                    rowEditor
                  ) : (
                    <RowDetails row={r} readyMinutes={readyMinutes} days={days} canEdit={canEdit} onEdit={() => onEditRow(i)} />
                  )}
                </div>
              )}
            </li>
          </BreakDividers>
        );
      })}
    </ol>
  );
}

function RowDetails({
  row: r,
  readyMinutes,
  days,
  canEdit,
  onEdit,
}: {
  row: Row;
  readyMinutes: number;
  days: string[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const t = r.times;
  const warmEnd = t.warmUp && t.warmUpMinutes ? toTime(toMinutes(t.warmUp) + t.warmUpMinutes) : null;
  const ready = t.perform ? toTime(toMinutes(t.perform) - readyMinutes) : null;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Detail label="School">{r.subtitle}</Detail>
        {days.length > 1 && <Detail label="Day">{formatDate(t.day, { year: undefined })}</Detail>}
        <Detail label="Warm-up">{t.warmUp ? `${displayTime(t.warmUp)}${warmEnd ? `–${displayTime(warmEnd)}` : ""}` : "Not set"}</Detail>
        <Detail label="Location">{t.location || "Not set"}</Detail>
        <Detail label="Ready position">{ready ? displayTime(ready) : "—"}</Detail>
        <Detail label="Performs">{t.perform ? displayTime(t.perform) : "TBA"}</Detail>
      </dl>
      {r.conflicts && <p className="mt-3 text-sm">⚠️ {r.conflicts}</p>}
      <Button type="button" variant="secondary" className="mt-4" disabled={!canEdit} onClick={onEdit}>
        Edit
      </Button>
    </>
  );
}

/** Editing one row from the view. Save and Cancel live in the footer. */
export function RowEditor({
  draft,
  original,
  bandId,
  bandOptions,
  takenBandIds = [],
  later,
  shiftLater,
  readyMinutes,
  breaks,
  days,
  onChange,
  onBandChange,
  onShiftLater,
  note,
}: {
  draft: Times;
  original: Times;
  /** Finals only: the picked band ("" = to be announced). */
  bandId?: string;
  bandOptions?: OrderBand[];
  takenBandIds?: string[];
  /** How many timed rows come after this one on the same day. */
  later: number;
  shiftLater: boolean;
  readyMinutes: number;
  breaks: BreakDraft[];
  days: string[];
  onChange: (patch: Partial<Times>) => void;
  onBandChange?: (bandId: string) => void;
  onShiftLater: (on: boolean) => void;
  /** Shown above the finalist picker, e.g. when names go public. */
  note?: ReactNode;
}) {
  const delta = original.perform && draft.perform && draft.day === original.day ? toMinutes(draft.perform) - toMinutes(original.perform) : 0;
  return (
    <div className="space-y-4">
      {note}
      {bandOptions && onBandChange && (
        <Field label="Finalist">
          <Select value={bandId ?? ""} onChange={(e) => onBandChange(e.target.value)}>
            <option value="">To be announced</option>
            {bandOptions.map((b) => (
              <option key={b.id} value={b.id} disabled={takenBandIds.includes(b.id) && b.id !== bandId}>
                {b.name} ({b.school})
              </option>
            ))}
          </Select>
        </Field>
      )}
      <TimesEditor value={draft} days={days} breaks={breaks} readyMinutes={readyMinutes} onChange={onChange} />
      {later > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-3 text-sm">
          <p className="font-medium">
            ⚠️ Changing this time doesn&apos;t move the {later} {later === 1 ? "band" : "bands"} after it.
          </p>
          {delta !== 0 && (
            <label className="mt-2 flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={shiftLater} onChange={(e) => onShiftLater(e.target.checked)} />
              <span>
                Also move {later === 1 ? "it" : `all ${later}`} {Math.abs(delta)} min {delta > 0 ? "later" : "earlier"}
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
