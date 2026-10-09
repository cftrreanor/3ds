"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select } from "@/components/ui";
import { VenuePicker, type VenueValue } from "@/components/venue-picker";
import type { ActionState } from "@/lib/action-state";
import { US_TIMEZONES } from "@/lib/time";

export type EventFormValues = {
  name?: string;
  startsOn?: string;
  endsOn?: string;
  startTime?: string;
  endTime?: string;
  timezone: string;
  venue?: VenueValue;
};

/** Used for both creating and editing an event. */
export function EventForm({
  action,
  organizationId,
  initial,
  venueSearchEnabled,
  submitLabel,
  hasShifts = false,
  eventType,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  organizationId: string;
  initial: EventFormValues;
  venueSearchEnabled: boolean;
  submitLabel: string;
  hasShifts?: boolean;
  /** For a new event: what kind it is (chosen before the form). */
  eventType?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-6" resetOnSuccess={false}>
      <input type="hidden" name="organizationId" value={organizationId} />
      {eventType && <input type="hidden" name="eventType" value={eventType} />}
      <Field label="Event name">
        <Input name="name" required defaultValue={initial.name} placeholder={eventType === "volunteer" ? "e.g. Fall Festival Concessions" : "e.g. Cedar Ridge Marching Invitational"} />
      </Field>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium">When</legend>
        {hasShifts && (
          <p className="rounded-md bg-brand-soft px-3 py-2 text-sm sm:col-span-2">
            Changing the date moves your existing shifts with it. A 7:00 AM shift stays at 7:00 AM on the new day.
          </p>
        )}
        <Field label="Start date">
          <Input name="startsOn" type="date" required defaultValue={initial.startsOn} />
        </Field>
        <Field label="End date" hint="Same as the start date for a one-day event.">
          <Input name="endsOn" type="date" required defaultValue={initial.endsOn} />
        </Field>
        <Field label="Gates open / first volunteers arrive">
          <Input name="startTime" type="time" defaultValue={initial.startTime ?? "07:00"} required />
        </Field>
        <Field label="Everything wraps up">
          <Input name="endTime" type="time" defaultValue={initial.endTime ?? "22:00"} required />
        </Field>
        <Field
          label="Event time zone"
          hint="Where the event happens. Every time on volunteer pages, emails and calendar invites uses this zone, whatever someone's phone is set to."
          className="sm:col-span-2"
        >
          <Select name="timezone" defaultValue={initial.timezone}>
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
        <VenuePicker searchEnabled={venueSearchEnabled} initial={initial.venue} />
      </fieldset>

      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
