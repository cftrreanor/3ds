"use client";

import { useTransition } from "react";
import { confirmDialog } from "@/components/confirm-dialog";

/** Done / Reopen and Delete for a note in a timeline or follow-ups list. */
export function NoteControls({
  followUp,
  done,
  toggle,
  remove,
}: {
  followUp: boolean;
  done: boolean;
  toggle: () => Promise<void>;
  remove: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-3 text-xs">
      {followUp && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(toggle)}
          className="font-semibold text-brand hover:underline disabled:opacity-50"
        >
          {done ? "Reopen" : "Mark done"}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (await confirmDialog({ title: "Delete this note?", confirmLabel: "Delete note", danger: true })) start(remove);
        }}
        className="text-muted hover:text-danger disabled:opacity-50"
      >
        Delete
      </button>
    </span>
  );
}
