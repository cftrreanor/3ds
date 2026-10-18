"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Card, FormMessage } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { confirmGuestByLink } from "../guest-actions";

/** One tap to finish registering; if the button has expired, the code box instead. */
export function ConfirmButton({
  pendingId,
  tokenHash,
  bandName,
  schoolName,
  fallback,
}: {
  pendingId: string;
  tokenHash: string;
  bandName: string;
  schoolName: string;
  fallback: ReactNode;
}) {
  const [state, action] = useActionState<ActionState, FormData>(() => confirmGuestByLink(pendingId, tokenHash), {});
  if (state.error?.includes("Send a new code")) {
    return (
      <div className="space-y-4">
        <FormMessage error={state.error} />
        {fallback}
      </div>
    );
  }
  return (
    <Card>
      <h1 className="text-2xl font-medium">Finish registering {bandName}</h1>
      <p className="mt-2 text-muted">{schoolName}</p>
      <form action={action} className="mt-5 space-y-3">
        <FormMessage error={state.error} />
        <SubmitButton className="w-full" pendingText="Confirming…">
          Confirm registration
        </SubmitButton>
      </form>
    </Card>
  );
}
