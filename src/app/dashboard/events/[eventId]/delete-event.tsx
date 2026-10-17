"use client";

import { useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/**
 * "Delete event", with a confirmation that spells out what's lost and
 * asks the host to tick that they understand before the red button works.
 */
export function DeleteEventButton({
  name,
  action,
}: {
  name: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sure, setSure] = useState(false);
  const close = () => {
    dialog.current?.close();
    setSure(false);
  };

  return (
    <>
      <Button type="button" variant="danger" onClick={() => dialog.current?.showModal()} className="px-3 text-sm">
        Delete event
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-event-title"
        onClick={(e) => e.target === e.currentTarget && close()}
        onClose={() => setSure(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-foreground shadow-elevated backdrop:bg-[#071a31]/50"
      >
        <div className="p-6">
          <h2 id="delete-event-title" className="text-xl font-semibold">
            Delete &ldquo;{name}&rdquo;?
          </h2>
          <p className="mt-3 leading-7">This permanently deletes the event and everything in it. It can&apos;t be undone.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            <li>All volunteer sign-ups, shifts, and check-ins</li>
            <li>All registrations (bands, groups, parents, and booths)</li>
            <li>Schedules, announcements, maps, and documents</li>
            <li>Your team&apos;s access to the event, and its public page</li>
          </ul>
          <p className="mt-3 text-sm text-muted">Nobody is emailed. People who signed up or registered won&apos;t be told it was deleted.</p>
          <label className="mt-5 flex items-start gap-3 text-sm font-medium">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--danger)]" />
            I understand that all of this event&apos;s data, including volunteer and registration information, will be lost.
          </label>
          <ActionForm action={action} className="mt-6 flex flex-wrap justify-end gap-2" resetOnSuccess={false}>
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton variant="warn" disabled={!sure} pendingText="Deleting…">
              Delete event
            </SubmitButton>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}
