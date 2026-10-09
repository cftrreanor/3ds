"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/** When parent registration closes on its own. Date and time are in the event's time zone. */
export function ClosesAtForm({
  action,
  date,
  time,
  zone,
  isSet,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  date: string;
  time: string;
  zone: string;
  isSet: boolean;
}) {
  return (
    <div className="space-y-2">
      <ActionForm action={action} resetOnSuccess={false} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Close registration on">
            <Input type="date" name="date" defaultValue={date} required className="w-44" />
          </Field>
          <Field label="At">
            <Input type="time" name="time" defaultValue={time} required className="w-36" />
          </Field>
          <SubmitButton variant="secondary">{isSet ? "Change" : "Set closing time"}</SubmitButton>
        </div>
        <p className="text-sm text-muted">{zone}. Registration closes on its own then; you can still open or close it yourself.</p>
      </ActionForm>
      {isSet && (
        <ActionForm action={action} confirmMessage="Remove the closing time? Registration stays open until you close it.">
          <input type="hidden" name="clear" value="1" />
          <SubmitButton variant="ghost" className="min-h-9 px-0 text-sm" pendingText="Removing…">
            Remove closing time
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
