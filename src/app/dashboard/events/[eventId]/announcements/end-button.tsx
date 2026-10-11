"use client";

import { useTransition } from "react";

/** "End now" for a live banner. */
export function EndButton({ end }: { end: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Take this banner down for everyone now?")) start(end);
      }}
      className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-background disabled:opacity-50"
    >
      {pending ? "Ending…" : "End now"}
    </button>
  );
}
