"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Button, Card, Field, FormMessage } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { confirmGuestRegistration, resendGuestCode } from "./guest-actions";

/**
 * The last step of registering without signing in first: type the code we
 * emailed to finish. A new code can be sent, and the email fixed.
 */
export function ConfirmCode({
  pendingId,
  email,
  bandName,
  onFixEmail,
}: {
  pendingId: string;
  email: string;
  bandName: string;
  /** Back to the form (answers kept) to correct the email address. */
  onFixEmail?: () => void;
}) {
  const [resent, setResent] = useState<ActionState>({});
  const [sending, start] = useTransition();

  return (
    <Card className="border-brand">
      <p className="text-sm font-semibold text-brand">One last step</p>
      <h2 className="mt-1 text-xl font-semibold">Confirm your email</h2>
      <p className="mt-2 leading-7" role="status">
        We sent a 6-digit code to <strong>{email}</strong>. Enter it to finish registering {bandName}.
      </p>
      <ActionForm action={confirmGuestRegistration.bind(null, pendingId)} className="mt-4 space-y-3" resetOnSuccess={false}>
        <Field label="Code from the email">
          <NumberInput name="code" maxLength={10} required autoFocus className="text-lg tracking-[0.3em] sm:max-w-48" />
        </Field>
        <SubmitButton pendingText="Confirming…">Confirm registration</SubmitButton>
      </ActionForm>
      <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm text-muted">
        <p>Didn&apos;t get it? It can take a minute, so check your spam folder too.</p>
        <div className="flex flex-wrap gap-x-4">
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-brand"
            disabled={sending}
            onClick={() => start(async () => setResent(await resendGuestCode(pendingId)))}
          >
            {sending ? "Sending…" : "Send a new code"}
          </Button>
          {onFixEmail && (
            <Button type="button" variant="ghost" className="px-0 text-brand" onClick={onFixEmail}>
              Fix the email address
            </Button>
          )}
        </div>
        <FormMessage error={resent.error} success={resent.message} />
      </div>
    </Card>
  );
}
