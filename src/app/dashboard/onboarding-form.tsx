"use client";

import { useEffect, useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ACCOUNT_RECORDS_NOTE } from "@/lib/records";
import { Field, Input, Select } from "@/components/ui";
import { US_TIMEZONES } from "@/lib/time";
import { createOrganization } from "./actions";

/** The browser's time zone, when it's one we list (Central otherwise). */
function browserZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return US_TIMEZONES.some((t) => t.value === tz) ? tz : "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

/**
 * A new host's account: their name, and the group their events run under.
 * Someone on their own (a teacher, a tutor) can leave the group blank and
 * their events go under their name. The invitation's name and organization,
 * when we have them, are filled in.
 */
export function OnboardingForm({ name = "", organization = "" }: { name?: string; organization?: string }) {
  // Set once in the browser, after the page loads: the server can't know where they are.
  const zone = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (zone.current) zone.current.value = browserZone();
  }, []);
  return (
    <ActionForm action={createOrganization} className="space-y-5" resetOnSuccess={false}>
      <Field label="Your name">
        <Input name="fullName" autoComplete="name" required defaultValue={name} />
      </Field>
      <Field label="Mobile phone" hint="Optional. Shown to your team on event day.">
        <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(512) 555-0100" />
      </Field>
      <Field
        label="School or group (optional)"
        hint="Who your events are for, like your school, PTO, or booster club. On your own? Leave it blank and your events go under your name."
      >
        <Input name="orgName" defaultValue={organization} placeholder="e.g. Oak Elementary" />
      </Field>
      <Field label="Time zone">
        <Select ref={zone} name="timezone" defaultValue="America/Chicago">
          {US_TIMEZONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-sm text-muted">{ACCOUNT_RECORDS_NOTE}</p>
      <SubmitButton pendingText="Setting up…">Set up my account</SubmitButton>
    </ActionForm>
  );
}
