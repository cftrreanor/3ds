"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Select, Textarea } from "@/components/ui";
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

/** Running behind: move everyone from a chosen band onward later, and email their directors. */
export function PushBackForm({
  action,
  bands,
  hasFinals,
  published,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Bands still to perform, in order: the first one is the default. */
  bands: { order: number; label: string }[];
  hasFinals: boolean;
  /** Directors only get emails once the schedule is published. */
  published: boolean;
}) {
  const [minutes, setMinutes] = useState("10");
  const [from, setFrom] = useState(String(bands[0]?.order ?? ""));
  const first = bands.find((b) => String(b.order) === from);
  return (
    <ActionForm
      action={action}
      resetOnSuccess={false}
      confirmMessage={`Move ${first?.label.split(" · ")[0] ?? "that band"} and every band after them ${minutes || "?"} minutes later?`}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starting with">
          <Select name="fromOrder" value={from} onChange={(e) => setFrom(e.target.value)}>
            {bands.map((b) => (
              <option key={b.order} value={b.order}>
                {b.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How many minutes later?">
          <NumberInput name="minutes" maxLength={3} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
      </div>
      {hasFinals && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="includeFinals" className="h-5 w-5 accent-[var(--brand)]" />
          Move the finals too
        </label>
      )}
      {published && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="email" defaultChecked className="h-5 w-5 accent-[var(--brand)]" />
          Email those bands&apos; directors their new times
        </label>
      )}
      <SubmitButton variant="warn" pendingText="Moving…">
        Push the schedule back
      </SubmitButton>
    </ActionForm>
  );
}
