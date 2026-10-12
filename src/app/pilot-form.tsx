"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm, useFieldErrors } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldError, Input, Textarea } from "@/components/ui";
import { fieldErrorState, type ActionState } from "@/lib/action-state";
import { checkPilotRequest, PILOT_EVENT_TYPES } from "@/lib/pilot";

/** Check every answer in the browser, so each problem shows under its field before anything is sent. */
function validate(data: FormData) {
  const { fieldErrors } = checkPilotRequest(data);
  return Object.keys(fieldErrors).length ? fieldErrorState(fieldErrors) : null;
}

export function PilotForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [startedAt] = useState(() => Date.now());
  if (sentTo !== null) return <Sent email={sentTo} />;
  return (
    <ActionForm action={action} validate={validate} onSuccess={() => setSentTo(email.trim())} className="space-y-5" noValidate>
      {/* Bot traps: people never see or fill this in, and bots submit instantly. */}
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Fields onEmail={setEmail} />
      <SubmitButton pendingText="Sending…" className="w-full sm:w-auto">
        Request a pilot spot
      </SubmitButton>
    </ActionForm>
  );
}

/** The answers, each with its own problem message (inside ActionForm, so it can read them). */
function Fields({ onEmail }: { onEmail: (email: string) => void }) {
  const errors = useFieldErrors();
  // Marks a field with a problem and links it to its message for screen readers.
  const problem = (name: string) => ({
    error: errors[name],
    errorId: `pilot-${name}-error`,
  });
  const describe = (name: string) =>
    errors[name] ? { "aria-invalid": true, "aria-describedby": `pilot-${name}-error` } : {};

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" {...problem("name")}>
          <Input name="name" required maxLength={200} autoComplete="name" {...describe("name")} />
        </Field>
        <Field label="Email" {...problem("email")}>
          <Input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            onChange={(e) => onEmail(e.target.value)}
            {...describe("email")}
          />
        </Field>
        <Field label="Phone" hint="10 digits, with area code. We'll use it to set up a short call." {...problem("phone")}>
          <Input name="phone" type="tel" required maxLength={30} autoComplete="tel" {...describe("phone")} />
        </Field>
        <Field label="School, PTO/PTA, booster club or other organization" {...problem("organization")}>
          <Input
            name="organization"
            required
            maxLength={200}
            autoComplete="organization"
            placeholder="e.g. Oak Elementary PTA"
            {...describe("organization")}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">What event types are you interested in planning and hosting?</legend>
        <p className="mt-1 text-sm text-muted">Pick at least one, or all that apply.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PILOT_EVENT_TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-surface px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft ${
                errors.eventTypes ? "border-danger" : "border-field-border"
              }`}
            >
              <input
                type="checkbox"
                name="eventTypes"
                value={t.value}
                className="size-4 accent-brand"
                {...describe("eventTypes")}
              />
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </label>
          ))}
        </div>
        {errors.eventTypes && (
          <p className="mt-2">
            <FieldError id="pilot-eventTypes-error">{errors.eventTypes}</FieldError>
          </p>
        )}
      </fieldset>
      <Field label="What's the hardest part about event planning and hosting for you today? (optional)" {...problem("notes")}>
        <Textarea name="notes" rows={3} maxLength={2000} {...describe("notes")} />
      </Field>
    </>
  );
}

/** Shown in place of the form once the request is in; takes focus so screen readers announce it. */
function Sent({ email }: { email: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="rounded-xl border border-success bg-surface p-6 outline-none">
      <p className="text-lg font-semibold">✓ Request sent</p>
      <p className="mt-2 leading-7 text-muted">
        Thanks! We&apos;ll be in touch within a few days{email ? <> at <strong className="text-foreground">{email}</strong></> : null}{" "}
        to set up a quick call. If you don&apos;t see our email, check your spam folder.
      </p>
    </div>
  );
}
