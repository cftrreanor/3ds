"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { emailMyLink, forgetThisDevice } from "./actions";

export function CancelShiftButton({ action, label }: { action: () => Promise<ActionState>; label: string }) {
  return (
    <ActionForm action={action} confirmMessage={`Cancel your ${label} shift? Your spot will open up for someone else.`}>
      <SubmitButton variant="ghost" pendingText="Cancelling…" className="min-h-9 px-2 text-sm">
        Cancel this shift
      </SubmitButton>
    </ActionForm>
  );
}

export function EmailMyLinkForm({ email }: { email?: string }) {
  return (
    <ActionForm action={emailMyLink} className="space-y-4" resetOnSuccess={false}>
      <Field label="The email you signed up with">
        <Input name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={email} />
      </Field>
      <SubmitButton pendingText="Sending…">Email me my link</SubmitButton>
    </ActionForm>
  );
}

export function ForgetDeviceButton() {
  return (
    <ActionForm
      action={forgetThisDevice}
      confirmMessage="Forget this device? You'll need the link in your email to see your shifts here again."
    >
      <SubmitButton variant="ghost" pendingText="Forgetting…" className="min-h-9 px-2 text-sm">
        Forget this device
      </SubmitButton>
    </ActionForm>
  );
}
