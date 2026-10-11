"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { PILOT_EVENT_TYPES } from "@/lib/pilot";

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
    <ActionForm action={action} onSuccess={() => setSent(true)} className="space-y-5">
      {/* Bot traps: people never see or fill this in, and bots submit instantly. */}
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" required maxLength={200} autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required maxLength={254} autoComplete="email" />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" required maxLength={30} autoComplete="tel" />
        </Field>
        <Field label="School, PTO/PTA, booster club or other organization">
          <Input name="organization" required maxLength={200} autoComplete="organization" placeholder="e.g. Oak Elementary PTA" />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">What event types are you interested in planning and hosting?</legend>
        <p className="mt-1 text-sm text-muted">Pick all that apply.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PILOT_EVENT_TYPES.map((t) => (
            <label
              key={t.value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <input type="checkbox" name="eventTypes" value={t.value} className="size-4 accent-brand" />
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="What's the hardest part about event planning and hosting for you today?" hint="Optional">
        <Textarea name="notes" rows={3} maxLength={2000} />
      </Field>
      <SubmitButton pendingText="Sending…" className="w-full sm:w-auto">
        Request a pilot spot
      </SubmitButton>
    </ActionForm>
  );
}
