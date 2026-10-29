"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/**
 * After the deadline passed: reopen registration with a new deadline (or
 * none), for a host who closed it too early or is giving directors more time.
 */
export function ReopenRegistration({
  action,
  today,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Today in the event's time zone (YYYY-MM-DD): the earliest new deadline. */
  today: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button type="button" variant="go" className="px-3! text-xs!" onClick={() => setOpen(true)}>
        Reopen registration
      </Button>
    );
  return (
    <ActionForm action={action} className="flex w-full flex-wrap items-end gap-3" onSuccess={() => setOpen(false)}>
      <Field label="New deadline" hint="Leave blank for no deadline. Registration closes at the end of this day.">
        <Input type="date" name="deadline" min={today} />
      </Field>
      <div className="flex gap-2 pb-0.5">
        <SubmitButton variant="go" pendingText="Reopening…">
          Reopen registration
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
