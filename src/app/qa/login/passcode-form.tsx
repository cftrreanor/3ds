"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input } from "@/components/ui";
import { openQa } from "./actions";

export function PasscodeForm({ next }: { next?: string }) {
  return (
    <ActionForm action={openQa} resetOnSuccess={false} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Passcode">
        <Input name="passcode" type="password" required autoComplete="current-password" autoFocus />
      </Field>
      <SubmitButton pendingText="Opening…">Open the QA site</SubmitButton>
    </ActionForm>
  );
}
