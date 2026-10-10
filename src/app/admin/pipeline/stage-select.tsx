"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";

/** Change a pilot request's stage from its record page. */
export function StageSelect({
  stages,
  value,
  move,
}: {
  stages: readonly { value: string; label: string }[];
  value: string;
  move: (stage: string) => Promise<ActionState>;
}) {
  const [stage, setStage] = useState(value);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <select
        aria-label="Stage"
        value={stage}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setStage(next);
          start(async () => {
            const res = await move(next);
            if (res.error) {
              setError(res.error);
              setStage(value);
            } else setError(null);
          });
        }}
        className="h-8 w-full rounded-sm border border-border bg-surface px-2 text-sm"
      >
        {stages.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
