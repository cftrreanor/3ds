"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";

export function CancelShiftButton({ action, label }: { action: () => Promise<ActionState>; label: string }) {
  return (
    <ActionForm action={action} confirmMessage={`Cancel your ${label} shift? Your spot will open up for someone else.`}>
      <SubmitButton variant="ghost" pendingText="Cancelling…" className="min-h-9 px-2 text-sm">
        Cancel this shift
      </SubmitButton>
    </ActionForm>
  );
}
