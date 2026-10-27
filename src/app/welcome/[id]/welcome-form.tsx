"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";

/** One tap signs them in as the invited email and opens account setup. */
export function WelcomeForm({ action, email }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; email: string }) {
  return (
    <ActionForm action={action} className="space-y-4" resetOnSuccess={false}>
      <SubmitButton className="w-full" pendingText="Signing you in…">
        Set up my account
      </SubmitButton>
      <p className="text-center text-xs text-muted">You&apos;ll be signed in as {email}. No password needed.</p>
    </ActionForm>
  );
}
