"use client";

import { useTransition } from "react";
import { confirmDialog } from "@/components/confirm-dialog";

/** "End now" for a live banner. */
export function EndButton({ end }: { end: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (await confirmDialog({ title: "Take this banner down for everyone now?", confirmLabel: "Take it down" })) start(end);
      }}
      className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-background disabled:opacity-50"
    >
      {pending ? "Ending…" : "End now"}
    </button>
  );
}
