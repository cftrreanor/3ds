"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/**
 * A big one-tap button for the contest-day screen. Stadium signal is patchy,
 * so a tap that doesn't reach the server says so plainly and can be tapped again.
 */
export function TapButton({
  action,
  children,
  variant = "primary",
  confirmMessage,
  className,
}: {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  confirmMessage?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        aria-busy={pending}
        className="w-full"
        onClick={() => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          setError(null);
          start(async () => {
            try {
              const result = await action();
              if (result?.error) setError(result.error);
            } catch {
              setError("That didn't go through. Check your signal and tap again.");
            }
          });
        }}
      >
        {pending ? "Saving…" : children}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function NoteForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} className="space-y-2">
      <Textarea name="body" rows={2} maxLength={500} required placeholder="e.g. Leaving for lunch at 11:30, back by 1:00" aria-label="Note" />
      <SubmitButton variant="secondary" pendingText="Adding…" className="min-h-9 px-3 text-xs">
        Add note
      </SubmitButton>
    </ActionForm>
  );
}

export function LotSizeForm({
  action,
  initial,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: number | null;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={false} className="flex flex-wrap items-end gap-2">
      <Field label="Equipment spots in the lot" hint="Optional. Leave blank if you don't want to track it.">
        <NumberInput name="equipmentSpots" defaultValue={initial ?? ""} maxLength={3} className="w-28" />
      </Field>
      <SubmitButton variant="secondary" className="min-h-11">
        Save
      </SubmitButton>
    </ActionForm>
  );
}
