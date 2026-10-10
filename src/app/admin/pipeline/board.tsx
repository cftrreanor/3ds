"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";

export type BoardCard = {
  id: string;
  organization: string;
  name: string;
  status: string;
  when: string | null;
  size: string | null;
  inStage: string;
  followUp: { date: string; due: boolean } | null;
  accountId: string | null;
};

/**
 * The pilot pipeline as columns. Drag a card to another stage, or use its
 * "Move to" menu (keyboard and phones).
 */
export function PipelineBoard({
  stages,
  cards,
  move,
}: {
  stages: readonly { value: string; label: string; hint: string }[];
  cards: BoardCard[];
  move: (id: string, stage: string) => Promise<ActionState>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(cards, (state, m: { id: string; stage: string }) =>
    state.map((c) => (c.id === m.id ? { ...c, status: m.stage, inStage: "Moved just now" } : c)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const moveTo = (id: string, stage: string) =>
    start(async () => {
      setOptimistic({ id, stage });
      const res = await move(id, stage);
      setError(res.error ?? null);
    });

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-sm border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-flow-col auto-cols-[minmax(10rem,1fr)] gap-2 overflow-x-auto pb-2">
        {stages.map((s) => {
          const list = optimistic.filter((c) => c.status === s.value);
          return (
            <section
              key={s.value}
              aria-label={s.label}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.value);
              }}
              onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                const card = optimistic.find((c) => c.id === id);
                if (card && card.status !== s.value) moveTo(id, s.value);
              }}
              className={`flex min-h-64 flex-col rounded-md border bg-background ${over === s.value ? "border-brand" : "border-border"} ${
                s.value === "declined" ? "opacity-80" : ""
              }`}
            >
              <header className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">{s.label}</h2>
                <span className="text-xs text-muted tabular-nums">{list.length}</span>
              </header>
              <p className="px-3 pt-1.5 text-xs text-muted">{s.hint}</p>
              <ul className="flex flex-1 flex-col gap-2 p-2">
                {list.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab rounded-sm border border-border bg-surface p-2.5 shadow-card active:cursor-grabbing"
                  >
                    <Link href={`/admin/pipeline/${c.id}`} className="block text-sm font-semibold hover:underline">
                      {c.organization}
                    </Link>
                    <p className="text-xs text-muted">{c.name}</p>
                    {(c.when || c.size) && <p className="mt-1 text-xs">{[c.when, c.size].filter(Boolean).join(" · ")}</p>}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                      <span className="text-xs text-muted">{c.inStage}</span>
                      {c.followUp && (
                        <span
                          className={`rounded-sm px-1.5 text-xs font-semibold ${c.followUp.due ? "bg-warning-soft text-foreground ring-1 ring-warning/30" : "bg-brand-soft"}`}
                        >
                          Follow up {c.followUp.date}
                        </span>
                      )}
                    </div>
                    <select
                      aria-label={`Move ${c.organization} to`}
                      value={c.status}
                      onChange={(e) => moveTo(c.id, e.target.value)}
                      className="mt-2 h-7 w-full rounded-sm border border-border bg-surface px-1 text-xs"
                    >
                      {stages.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.value === c.status ? o.label : `Move to ${o.label}`}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
                {list.length === 0 && <li className="px-1 py-4 text-center text-xs text-muted">Drop a card here</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
