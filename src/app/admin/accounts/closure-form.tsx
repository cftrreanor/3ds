"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/** Close an account (deleted 90 days later), or reopen a closed one. */
export function ClosureForm({
  action,
  closed,
  deleteOn,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  closed: boolean;
  /** The day it will be (or would be) deleted, already formatted. */
  deleteOn: string;
}) {
  return (
    <ActionForm
      action={action}
      className="space-y-3"
      confirmMessage={
        closed
          ? undefined
          : `Close this account? On ${deleteOn} the organization, its events, and everyone's details in them will be deleted for good. You can reopen it before then.`
      }
    >
      <Field label="Note (optional)" hint="Why, for the admin activity log.">
        <Input name="note" maxLength={500} placeholder={closed ? "e.g. Renewed for next season" : "e.g. Not continuing after the pilot"} />
      </Field>
      <SubmitButton variant={closed ? "secondary" : "danger"} pendingText={closed ? "Reopening…" : "Closing…"}>
        {closed ? "Reopen account" : "Close account"}
      </SubmitButton>
    </ActionForm>
  );
}

/** An account action with an optional note for the activity log: upgrade, suspend, unsuspend. */
export function NoteActionForm({
  action,
  label,
  pendingText,
  danger = false,
  confirmMessage,
  placeholder,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  pendingText: string;
  danger?: boolean;
  confirmMessage?: string;
  placeholder?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-3" confirmMessage={confirmMessage}>
      <Field label="Note (optional)" hint="Why, for the admin activity log.">
        <Input name="note" maxLength={500} placeholder={placeholder} />
      </Field>
      <SubmitButton variant={danger ? "danger" : "secondary"} pendingText={pendingText}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
