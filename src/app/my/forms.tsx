"use client";

import { ActionForm } from "@/components/action-form";
import { BotCheck } from "@/components/bot-check";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select } from "@/components/ui";
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

export function CancelItemButton({ action, label }: { action: () => Promise<ActionState>; label: string }) {
  return (
    <ActionForm action={action} confirmMessage={`Cancel bringing ${label}? Someone else can sign up for it.`}>
      <SubmitButton variant="ghost" pendingText="Cancelling…" className="min-h-9 px-2 text-sm">
        Cancel
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
      <BotCheck />
      <SubmitButton pendingText="Sending…">Email me my link</SubmitButton>
    </ActionForm>
  );
}

export function ForgetDeviceButton() {
  return (
    <ActionForm
      action={forgetThisDevice}
      confirmMessage="Forget this device? You'll need the link in your email to see your sign-ups here again."
    >
      <SubmitButton variant="ghost" pendingText="Forgetting…" className="min-h-9 px-2 text-sm">
        Forget this device
      </SubmitButton>
    </ActionForm>
  );
}

/** "Switch to another time": the open shifts this person can take instead, and a Switch button. */
export function SwitchShiftForm({
  action,
  options,
  open: startOpen = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  options: { id: string; label: string }[];
  /** Open already (they came from "Change my sign-up" in their email). */
  open?: boolean;
}) {
  return (
    <details className="group mt-2" open={startOpen}>
      <summary className="inline-flex min-h-9 cursor-pointer items-center text-sm font-medium text-brand underline-offset-4 hover:underline">
        Switch to another time
      </summary>
      <ActionForm action={action} className="mt-2 flex flex-wrap items-end gap-2" resetOnSuccess={false}>
        <Field label="Switch to" className="min-w-0 flex-1">
          <Select name="shiftId" required defaultValue="">
            <option value="" disabled>
              Pick a shift
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton pendingText="Switching…">Switch</SubmitButton>
      </ActionForm>
    </details>
  );
}
