"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select } from "@/components/ui";
import { US_TIMEZONES } from "@/lib/time";
import { createEvent } from "../../actions";

export function EventForm({ organizationId, defaultTimezone }: { organizationId: string; defaultTimezone: string }) {
  return (
    <ActionForm action={createEvent} className="space-y-6" resetOnSuccess={false}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <Field label="Event name">
        <Input name="name" required placeholder="e.g. Cedar Ridge Marching Invitational" />
      </Field>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium">When</legend>
        <Field label="Start date">
          <Input name="startsOn" type="date" required />
        </Field>
        <Field label="End date" hint="Same as the start date for a one-day event.">
          <Input name="endsOn" type="date" required />
        </Field>
        <Field label="Gates open / first volunteers arrive">
          <Input name="startTime" type="time" defaultValue="07:00" required />
        </Field>
        <Field label="Everything wraps up">
          <Input name="endTime" type="time" defaultValue="22:00" required />
        </Field>
        <Field label="Time zone" className="sm:col-span-2">
          <Select name="timezone" defaultValue={defaultTimezone}>
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-3 text-sm font-medium">Where</legend>
        <Field label="Venue name" hint="Optional.">
          <Input name="venueName" placeholder="e.g. Panther Stadium" />
        </Field>
        <Field label="Venue address">
          <Input name="venueAddress" required autoComplete="street-address" />
        </Field>
      </fieldset>

      <SubmitButton pendingText="Creating…">Create event</SubmitButton>
    </ActionForm>
  );
}
