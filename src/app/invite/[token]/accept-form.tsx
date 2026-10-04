"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
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
