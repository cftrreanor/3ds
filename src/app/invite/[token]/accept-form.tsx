"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function AcceptForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} className="space-y-4" resetOnSuccess={false}>
      <SubmitButton className="w-full" pendingText="Joining…">
        Accept invitation
      </SubmitButton>
    </ActionForm>
  );
}

/** From the invitation email: one tap signs them in as the invited email and joins. */
export function JoinForm({
  action,
  email,
  needsName,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  email: string;
  needsName: boolean;
}) {
  return (
    <ActionForm action={action} className="space-y-4" resetOnSuccess={false}>
      {needsName && (
        <Field label="Your name" hint="So the team knows who you are.">
          <Input name="fullName" required minLength={2} maxLength={200} autoComplete="name" />
        </Field>
      )}
      <SubmitButton className="w-full" pendingText="Joining…">
        Accept and join
      </SubmitButton>
      <p className="text-center text-xs text-muted">
        You&apos;ll be signed in as {email}. No password needed.
      </p>
    </ActionForm>
  );
}
