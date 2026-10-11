"use client";

import { useOptimistic, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";

/** One tap: a partner has arrived (tap again to undo). */
export function ArrivedButton({
  arrived,
  time,
  toggle,
}: {
  arrived: boolean;
  time: string | null;
  toggle: (arrived: boolean) => Promise<ActionState>;
}) {
  const [shown, setShown] = useOptimistic(arrived);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={shown}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setShown(!shown);
          await toggle(!shown);
        })
      }
      className={`min-h-11 min-w-32 rounded-md px-4 text-sm font-semibold transition ${
        shown ? "bg-success text-success-foreground hover:opacity-90" : "border border-border bg-surface hover:border-brand"
      }`}
    >
      {shown ? `✓ Arrived${time ? ` ${time}` : ""}` : "Arrived"}
    </button>
  );
}
