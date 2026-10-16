"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select } from "@/components/ui";
import { ACCOUNT_RECORDS_NOTE } from "@/lib/records";
import { US_TIMEZONES } from "@/lib/time";
import { createTeacherAccount } from "./actions";

/** Name, school and time zone: all a free teacher account needs. */
export function TeacherForm({ name }: { name: string }) {
  return (
    <ActionForm action={createTeacherAccount} className="space-y-5" resetOnSuccess={false}>
      <Field label="Your name" hint="How families see you, e.g. “Ms. Rivera”.">
        <Input name="fullName" autoComplete="name" required maxLength={120} defaultValue={name} />
      </Field>
      <Field label="School">
        <Input name="school" autoComplete="organization" required maxLength={160} />
      </Field>
      <Field label="Time zone">
        <Select name="timezone" defaultValue="America/Chicago">
          {US_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-sm text-muted">{ACCOUNT_RECORDS_NOTE}</p>
      <SubmitButton pendingText="Setting up…">Start my conferences</SubmitButton>
    </ActionForm>
  );
}
