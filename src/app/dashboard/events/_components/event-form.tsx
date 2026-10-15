"use client";

import { useState } from "react";
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
  // Venue search favors the part of the country in the event's time zone.
  const [timezone, setTimezone] = useState(initial.timezone);
  // Conferences are one day: the end date follows the start date.
  const conference = eventType === "conference";
  const [day, setDay] = useState(initial.startsOn ?? "");
  return (
    <ActionForm action={action} className="space-y-6" resetOnSuccess={false}>
      <input type="hidden" name="organizationId" value={organizationId} />
      {eventType && <input type="hidden" name="eventType" value={eventType} />}
      <Field label="Event name">
        <Input name="name" required defaultValue={initial.name} placeholder={conference ? "e.g. Fall Parent-Teacher Conferences" : eventType === "volunteer" ? "e.g. Fall Festival Concessions" : eventType === "school_visit" ? "e.g. Thanksgiving Lunch with Families" : eventType === "group_event" ? "e.g. Spring Arts Festival" : "e.g. Cedar Ridge Marching Invitational"} />
      </Field>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium">When</legend>
        {hasShifts && (
          <p className="rounded-md bg-brand-soft px-3 py-2 text-sm sm:col-span-2">
            Changing the date moves your existing shifts with it. A 7:00 AM shift stays at 7:00 AM on the new day.
          </p>
        )}
        {conference ? (
          <>
            <Field label="Conference day" className="sm:col-span-2">
              <Input name="startsOn" type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <input type="hidden" name="endsOn" value={day} />
            <Field label="First meeting starts">
              <Input name="startTime" type="time" defaultValue={initial.startTime ?? "15:00"} required />
            </Field>
            <Field label="Last meeting ends by">
              <Input name="endTime" type="time" defaultValue={initial.endTime ?? "19:00"} required />
            </Field>
          </>
        ) : (
          <>
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
          </>
        )}
        <Field
          label="Event time zone"
          hint="Where the event happens. Every time on volunteer pages, emails and calendar invites uses this zone, whatever someone's phone is set to."
          className="sm:col-span-2"
        >
          <Select name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-3 text-sm font-medium">{conference ? "Your school" : "Where"}</legend>
        {conference && (
          <p className="-mt-1 text-sm text-muted">Even for video meetings. You&apos;ll add your room or meeting link next.</p>
        )}
        <VenuePicker searchEnabled={venueSearchEnabled} initial={initial.venue} timezone={timezone} />
      </fieldset>

      {eventType === "school_visit" && (
        <p className="rounded-md border border-border bg-brand-soft px-3 py-2 text-sm leading-6">
          🔒 <strong>Student privacy:</strong> parents enter their children&apos;s names, teachers and grades. Only your
          event team can see them, and they&apos;re permanently deleted 30 days after the event ends. Parents are told
          this when they register.
        </p>
      )}

      {conference && (
        <p className="rounded-md border border-border bg-brand-soft px-3 py-2 text-sm leading-6">
          🔒 <strong>Family privacy:</strong> families see only the open times, never who else booked. Children&apos;s
          names and parents&apos; notes are seen only by you and are permanently deleted 30 days after the conference.
        </p>
      )}

      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
