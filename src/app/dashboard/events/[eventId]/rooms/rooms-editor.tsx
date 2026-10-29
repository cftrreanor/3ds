"use client";

import { useRef, useState, useTransition } from "react";
import { NumberInput } from "@/components/number-input";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import type { Room } from "@/lib/rooms";
import type { RoomInput } from "./actions";
import { markChanged, markSaved, SaveFooter } from "./save-footer";

type Row = RoomInput & { key: string };

let nextKey = 0;
const blank = (onPath: boolean): Row => ({ key: `new-${nextKey++}`, name: "", note: "", onPath, minutes: 20 });

/**
 * The festival's rooms. A room is a name plus an optional note (a room
 * number, "east hallway"); rooms on the path are visited by every group, in
 * this order, each for its number of minutes.
 */
export function RoomsEditor({ rooms, save }: { rooms: Room[]; save: (rooms: RoomInput[]) => Promise<ActionState> }) {
  const sorted = [
    ...rooms.filter((r) => r.path_order != null).sort((a, b) => a.path_order! - b.path_order!),
    ...rooms.filter((r) => r.path_order == null).sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const [rows, setRows] = useState<Row[]>(() =>
    sorted.length
      ? sorted.map((r) => ({ key: r.id, id: r.id, name: r.name, note: r.note ?? "", onPath: r.path_order != null, minutes: r.minutes }))
      : [
          { ...blank(true), name: "Warm-up", minutes: 20 },
          { ...blank(true), name: "Main Stage", minutes: 15 },
          { ...blank(true), name: "Sight-reading", minutes: 20 },
        ],
  );
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // Every change goes through here: the footer says it's unsaved, and leaving the tab asks first.
  const edit = (next: (list: Row[]) => Row[]) => {
    setRows(next);
    setDirty(true);
    markChanged(form);
  };
  const set = (i: number, patch: Partial<Row>) => edit((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) =>
    edit((list) => {
      const next = [...list];
      const [r] = next.splice(i, 1);
      next.splice(i + by, 0, r);
      return next;
    });
  const stop = (i: number) => rows.slice(0, i + 1).filter((r) => r.onPath).length;

  return (
    <Card>
      <form
        ref={form}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await save(rows.map((r) => ({ id: r.id, name: r.name, note: r.note, onPath: r.onPath, minutes: r.minutes })));
            setState(r);
            if (r.ok) setDirty(false);
            markSaved(form, Boolean(r.ok));
          });
        }}
      >
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.key} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-8 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${r.onPath ? "bg-brand text-brand-foreground" : "bg-background text-muted ring-1 ring-border"}`}
                >
                  {r.onPath ? stop(i) : "–"}
                </span>
                <Field label="Room" className="min-w-40 flex-1">
                  <Input value={r.name} onChange={(e) => set(i, { name: e.target.value })} required placeholder="e.g. Main Stage" maxLength={80} />
                </Field>
                <Field label="Where (optional)" className="min-w-40 flex-1">
                  <Input value={r.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="e.g. Room 112, east hallway" maxLength={200} />
                </Field>
                {r.onPath && (
                  <Field label="Minutes" className="w-24">
                    <NumberInput
                      value={String(r.minutes || "")}
                      onChange={(e) => set(i, { minutes: Number(e.target.value) })}
                      maxLength={3}
                      aria-label={`Minutes in ${r.name || "this room"}`}
                    />
                  </Field>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-sm">
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={r.onPath}
                    onChange={(e) => set(i, { onPath: e.target.checked })}
                    className="h-5 w-5 accent-[var(--brand)]"
                  />
                  Every group visits this room
                </label>
                <button type="button" className="min-h-11 text-muted hover:text-foreground disabled:opacity-40" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑ Earlier
                </button>
                <button
                  type="button"
                  className="min-h-11 text-muted hover:text-foreground disabled:opacity-40"
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓ Later
                </button>
                <button type="button" className="min-h-11 font-medium text-danger hover:underline" onClick={() => edit((list) => list.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => edit((list) => [...list, blank(true)])}>
            + Add a room
          </Button>
        </div>
        <p className="text-sm text-muted">
          Numbered rooms are each group&apos;s path, in order. Rooms without a number (a hospitality room, say) are just listed
          for everyone.
        </p>
        <FormMessage error={state.error} success={state.ok && !dirty ? state.message : null} />
        <SaveFooter dirty={dirty} saved={rooms.length > 0} pending={pending} label="Save rooms" />
      </form>
    </Card>
  );
}
