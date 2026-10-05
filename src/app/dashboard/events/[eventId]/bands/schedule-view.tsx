"use client";

import { useState, type ReactNode } from "react";
import { Badge, Button, Field, Select } from "@/components/ui";
import { displayTime, toMinutes, toTime } from "@/lib/schedule";
import { formatDate } from "@/lib/time";
import { BreakDividers, TimesEditor, type BreakDraft, type FinalsSlot, type OrderBand, type Times } from "./schedule-parts";

/** One row of the published schedule: a band in the order, or a finals slot. */
type Row = { key: string; number: string; title: string; subtitle: string; conflicts: string | null; times: Times; bandId?: string };

export type RowEdit = { round: "order" | "finals"; index: number; times: Times; bandId?: string; shiftLater: boolean };

/**
 * The published schedule, read-only: tap a band for its details and to change
 * just that band. The full builder is one tap away for bigger changes.
 */
export function ScheduleView({
  bands,
  finals,
  breaks,
  readyMinutes,
  days,
  orderPublished,
  finalsPublished,
  pending,
  onEditAll,
  onSaveRow,
}: {
  bands: OrderBand[];
  finals: FinalsSlot[];
  breaks: BreakDraft[];
  readyMinutes: number;
  days: string[];
  orderPublished: boolean;
  finalsPublished: boolean;
  pending: boolean;
  onEditAll: () => void;
  onSaveRow: (edit: RowEdit) => Promise<boolean>;
}) {
  const name = (id: string) => bands.find((b) => b.id === id);
  const orderRows: Row[] = bands.map((b, i) => ({
    key: b.id,
    number: String(i + 1),
    title: b.name,
    subtitle: `${b.school} · ${b.classification}`,
    conflicts: b.conflicts,
    times: b,
  }));
  const finalsRows: Row[] = finals.map((f, i) => {
    const band = f.bandId ? name(f.bandId) : undefined;
    return {
      key: `f${i}`,
      number: `F${i + 1}`,
      title: band?.name ?? `Finalist ${i + 1}`,
      subtitle: band ? band.school : "To be announced",
      conflicts: null,
      times: f,
      bandId: f.bandId,
    };
  });
  const picked = finals.filter((f) => f.bandId).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted">Tap a band to see its times or change just that band.</p>
        <Button type="button" variant="secondary" onClick={onEditAll}>
          Edit full schedule
        </Button>
      </div>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">Running order</h3>
          <Badge tone={orderPublished ? "brand" : "neutral"}>{orderPublished ? "Published" : "Not published"}</Badge>
        </div>
        <Rows rows={orderRows} round="order" breaks={breaks} readyMinutes={readyMinutes} days={days} pending={pending} onSaveRow={onSaveRow} />
      </section>

      {finals.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">🏆 Finals</h3>
            <Badge tone={finalsPublished ? "brand" : "neutral"}>{finalsPublished ? "Published" : "Not published"}</Badge>
            <span className="text-sm text-muted">
              {picked} of {finals.length} finalists picked
            </span>
          </div>
          <Rows
            rows={finalsRows}
            round="finals"
            breaks={breaks}
            readyMinutes={readyMinutes}
            days={days}
            pending={pending}
            onSaveRow={onSaveRow}
            bandOptions={bands}
            takenBandIds={finals.map((f) => f.bandId).filter(Boolean)}
          />
        </section>
      )}
    </div>
  );
}

function Rows({
  rows,
  round,
  breaks,
  readyMinutes,
  days,
  pending,
  onSaveRow,
  bandOptions,
  takenBandIds = [],
}: {
  rows: Row[];
  round: "order" | "finals";
  breaks: BreakDraft[];
  readyMinutes: number;
  days: string[];
  pending: boolean;
  onSaveRow: (edit: RowEdit) => Promise<boolean>;
  bandOptions?: OrderBand[];
  takenBandIds?: string[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <ol className="mt-3 space-y-2">
      {rows.map((r, i) => (
        <BreakDividers key={r.key} breaks={breaks} prev={rows[i - 1]?.times} cur={r.times}>
          <ViewRow
            row={r}
            open={openKey === r.key}
            onToggle={() => setOpenKey(openKey === r.key ? null : r.key)}
            later={rows.slice(i + 1).filter((x) => x.times.day === r.times.day && x.times.perform).length}
            readyMinutes={readyMinutes}
            breaks={breaks}
            days={days}
            pending={pending}
            bandOptions={bandOptions}
            takenBandIds={takenBandIds}
            onSave={async (times, bandId, shiftLater) => {
              const ok = await onSaveRow({ round, index: i, times, bandId, shiftLater });
              if (ok) setOpenKey(null);
              return ok;
            }}
          />
        </BreakDividers>
      ))}
    </ol>
  );
}

function ViewRow({
  row: r,
  open,
  onToggle,
  later,
  readyMinutes,
  breaks,
  days,
  pending,
  bandOptions,
  takenBandIds,
  onSave,
}: {
  row: Row;
  open: boolean;
  onToggle: () => void;
  /** How many timed bands come after this one on the same day. */
  later: number;
  readyMinutes: number;
  breaks: BreakDraft[];
  days: string[];
  pending: boolean;
  bandOptions?: OrderBand[];
  takenBandIds: string[];
  onSave: (times: Times, bandId: string | undefined, shiftLater: boolean) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Times>(r.times);
  const [bandId, setBandId] = useState(r.bandId ?? "");
  const [shiftLater, setShiftLater] = useState(false);
  const t = r.times;
  const warmEnd = t.warmUp && t.warmUpMinutes ? toTime(toMinutes(t.warmUp) + t.warmUpMinutes) : null;
  const ready = t.perform ? toTime(toMinutes(t.perform) - readyMinutes) : null;
  const delta = t.perform && draft.perform && draft.day === t.day ? toMinutes(draft.perform) - toMinutes(t.perform) : 0;

  const startEdit = () => {
    setDraft(r.times);
    setBandId(r.bandId ?? "");
    setShiftLater(false);
    setEditing(true);
  };

  return (
    <li className={`rounded-xl border bg-surface ${open ? "border-brand" : "border-border"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="w-8 shrink-0 text-center text-sm font-semibold text-muted">{r.number}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{r.title}</span>
          <span className="block truncate text-sm text-muted">
            {t.warmUp ? `Warm-up ${displayTime(t.warmUp)}${t.location ? ` · ${t.location}` : ""}` : r.subtitle}
          </span>
        </span>
        <span className="shrink-0 text-right font-semibold tabular-nums">{t.perform ? displayTime(t.perform) : "TBA"}</span>
        <span aria-hidden="true" className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          {!editing ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Detail label="School">{r.subtitle}</Detail>
                {days.length > 1 && <Detail label="Day">{formatDate(t.day, { year: undefined })}</Detail>}
                <Detail label="Warm-up">
                  {t.warmUp ? `${displayTime(t.warmUp)}${warmEnd ? `–${displayTime(warmEnd)}` : ""}` : "Not set"}
                </Detail>
                <Detail label="Location">{t.location || "Not set"}</Detail>
                <Detail label="Ready position">{ready ? displayTime(ready) : "—"}</Detail>
                <Detail label="Performs">{t.perform ? displayTime(t.perform) : "TBA"}</Detail>
              </dl>
              {r.conflicts && <p className="mt-3 text-sm">⚠️ {r.conflicts}</p>}
              <Button type="button" variant="secondary" className="mt-4" onClick={startEdit}>
                {r.bandId !== undefined ? "Edit this slot" : "Edit this band's times"}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {bandOptions && (
                <Field label="Finalist">
                  <Select value={bandId} onChange={(e) => setBandId(e.target.value)}>
                    <option value="">To be announced</option>
                    {bandOptions.map((b) => (
                      <option key={b.id} value={b.id} disabled={takenBandIds.includes(b.id) && b.id !== r.bandId}>
                        {b.name} ({b.school})
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <TimesEditor value={draft} days={days} breaks={breaks} readyMinutes={readyMinutes} onChange={(p) => setDraft({ ...draft, ...p })} />
              {later > 0 && (
                <div className="rounded-lg border border-accent bg-accent-soft px-3 py-3 text-sm">
                  <p className="font-medium">
                    ⚠️ Changing this time doesn&apos;t move the {later} {later === 1 ? "band" : "bands"} after it.
                  </p>
                  {delta !== 0 && (
                    <label className="mt-2 flex items-start gap-2">
                      <input type="checkbox" className="mt-1 h-4 w-4" checked={shiftLater} onChange={(e) => setShiftLater(e.target.checked)} />
                      <span>
                        Also move {later === 1 ? "it" : `all ${later}`} {Math.abs(delta)} min {delta > 0 ? "later" : "earlier"}
                      </span>
                    </label>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    if (await onSave(draft, bandOptions ? bandId : undefined, shiftLater && delta !== 0)) setEditing(false);
                  }}
                >
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
              <p className="text-sm text-muted">Saved changes are visible to directors and the public right away.</p>
            </div>
          )}
        </div>
      )}
    </li>
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
