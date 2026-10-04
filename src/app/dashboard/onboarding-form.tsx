"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select } from "@/components/ui";
import { US_TIMEZONES } from "@/lib/time";
import { createOrganization } from "./actions";

export function OnboardingForm() {
  return (
    <ActionForm action={createOrganization} className="space-y-5" resetOnSuccess={false}>
      <Field label="Your name">
        <Input name="fullName" autoComplete="name" required />
      </Field>
      <Field label="Mobile phone" hint="Optional. Shown to your volunteer leads on event day.">
        <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(512) 555-0100" />
      </Field>
      <Field label="Organization name" hint="The group hosting the contest, e.g. “Cedar Ridge Band Boosters”.">
        <Input name="orgName" required />
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
      <SubmitButton pendingText="Creating…">Create organization</SubmitButton>
    </ActionForm>
  );
}
