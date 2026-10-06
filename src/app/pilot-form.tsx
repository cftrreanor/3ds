"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function PilotForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [sent, setSent] = useState(false);
  const [startedAt] = useState(() => Date.now());
  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-success bg-surface p-6">
        <p className="text-lg font-semibold">✓ Request sent</p>
        <p className="mt-2 leading-7 text-muted">Thanks! We&apos;ll be in touch within a few days to set up a quick call.</p>
      </div>
    );
  }
  return (
    <ActionForm action={action} onSuccess={() => setSent(true)} className="space-y-4">
      {/* Bot traps: people never see or fill this in, and bots submit instantly. */}
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <Input name="name" required maxLength={200} autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required maxLength={254} autoComplete="email" />
        </Field>
        <Field label="School or booster program">
          <Input name="organization" required maxLength={200} placeholder="e.g. Lakeside HS Band Boosters" />
        </Field>
        <Field label="Phone" hint="Optional">
          <Input name="phone" type="tel" maxLength={30} autoComplete="tel" />
        </Field>
        <Field label="Contest name" hint="Optional">
          <Input name="contestName" maxLength={200} placeholder="e.g. Lakeside Marching Invitational" />
        </Field>
        <Field label="When is it?" hint="Optional">
          <Input name="contestWhen" maxLength={100} placeholder="e.g. October 2026" />
        </Field>
        <Field label="About how many bands?" hint="Optional">
          <NumberInput name="bands" maxLength={3} />
        </Field>
        <Field label="About how many volunteers?" hint="Optional">
          <NumberInput name="volunteers" maxLength={4} />
        </Field>
      </div>
      <Field label="Anything else we should know?" hint="Optional">
        <Textarea name="notes" rows={3} maxLength={2000} placeholder="What's hardest about contest day for you today?" />
      </Field>
      <SubmitButton variant="accent" pendingText="Sending…" className="w-full sm:w-auto">
        Request a pilot spot
      </SubmitButton>
    </ActionForm>
  );
}
