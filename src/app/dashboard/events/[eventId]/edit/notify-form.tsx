"use client";

import { ActionForm, useFieldErrors } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type TeamMember = { id: string; name: string; email: string | null; role: string };

/** Edit details → Notifications: tick people on the account, and add other addresses. */
export function NotifyForm({
  action,
  members,
  picked,
  extraEmails,
  max,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  members: TeamMember[];
  /** Who's ticked now (the saved choice, or who gets them today). */
  picked: string[];
  extraEmails: string[];
  max: number;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold">People on your account</legend>
        <div className="mt-2 space-y-2">
          {members.map((m) => (
            <label key={m.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-field-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="member"
                value={m.id}
                defaultChecked={picked.includes(m.id)}
                disabled={!m.email}
                className="h-4 w-4 shrink-0 accent-[var(--brand)]"
              />
              <span className="min-w-0">
                <span className="font-medium">{m.name}</span> <span className="text-muted">· {m.role}</span>
                <span className="block break-all text-muted">{m.email ?? "No email on file"}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <ExtraEmails defaultValue={extraEmails.join("\n")} max={max} />
      <SubmitButton>Save notifications</SubmitButton>
    </ActionForm>
  );
}

function ExtraEmails({ defaultValue, max }: { defaultValue: string; max: number }) {
  const error = useFieldErrors().extraEmails;
  return (
    <Field
      label={`Other email addresses (optional, up to ${max})`}
      hint="One per line, like your front office. They get the same emails, including names and notes, so add only people you trust with them. Families are told their details go to the people you choose."
      error={error}
      errorId="extra-emails-error"
    >
      <Textarea
        name="extraEmails"
        rows={3}
        defaultValue={defaultValue}
        autoComplete="off"
        spellCheck={false}
        placeholder="office@school.org"
        aria-describedby={error ? "extra-emails-error" : undefined}
      />
    </Field>
  );
}
