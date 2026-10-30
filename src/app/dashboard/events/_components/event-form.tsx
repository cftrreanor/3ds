"use client";

import { useState, type ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select } from "@/components/ui";
import { VenuePicker, type VenueValue } from "@/components/venue-picker";
import type { ActionState } from "@/lib/action-state";
import Link from "next/link";
import { US_TIMEZONES } from "@/lib/time";
import { hasConferences, isMeeting } from "@/lib/event-types";
import { SetupFooter } from "./setup-steps";

export type EventFormValues = {
  name?: string;
  startsOn?: string;
  endsOn?: string;
  startTime?: string;
  endTime?: string;
  timezone: string;
  venue?: VenueValue;
  /** Conferences: whether families give their child's name when they book. */
  askChildName?: boolean;
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
  when,
  stickySave = false,
  setup,
  extra,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  organizationId: string;
  initial: EventFormValues;
  venueSearchEnabled: boolean;
  submitLabel: string;
  hasShifts?: boolean;
  /** For a new event: what kind it is (chosen before the form). */
  eventType?: string;
  /**
   * Conferences and meetings, once created: the day or weekly hours as set in
   * their setup page, the one place they're changed.
   */
  when?: { summary: string; href: string; setupName: string };
  /** Editing: Save sits in a footer pinned to the bottom of the screen until the form ends, saying whether anything's unsaved. */
  stickySave?: boolean;
  /** A new event's guided setup: saving goes on to the `next` step (Event settings, ?setup=1). */
  setup?: { next?: string; back?: string };
  /** More to set up on this step, just above the Save button (the logo and color, which save on their own). */
  extra?: ReactNode;
}) {
  const [dirty, setDirty] = useState(false);
  // Venue search favors the part of the country in the event's time zone.
  const [timezone, setTimezone] = useState(initial.timezone);
  const conference = hasConferences(eventType);
  const meeting = isMeeting(eventType);
  // A new conference or meeting starts a week out, 3–7 PM, until the first setup step sets the real day or weekly hours.
  const [placeholderDay] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  return (
    <ActionForm
      action={action}
      className="space-y-6"
      resetOnSuccess={false}
      onEdit={stickySave ? () => setDirty(true) : undefined}
      onSuccess={stickySave ? () => setDirty(false) : undefined}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      {eventType && <input type="hidden" name="eventType" value={eventType} />}
      <Field label="Event name">
        <Input name="name" required defaultValue={initial.name} placeholder={meeting ? "e.g. Fall Advising Meetings" : conference ? "e.g. Fall Parent-Teacher Conferences" : eventType === "volunteer" ? "e.g. Community Cleanup Day" : eventType === "school_visit" ? "e.g. Thanksgiving Lunch with Families" : eventType === "group_event" ? "e.g. Spring Arts Festival" : eventType === "fair" ? "e.g. Oak Hills Spring Carnival" : "e.g. Cedar Ridge Marching Invitational"} />
      </Field>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 w-full border-b border-border pt-2 pb-1 font-semibold">When</legend>
        {hasShifts && (
          <p className="rounded-md bg-brand-soft px-3 py-2 text-sm sm:col-span-2">
            Changing the date moves your existing shifts with it. A 7:00 AM shift stays at 7:00 AM on the new day.
          </p>
        )}
        {conference ? (
          <>
            {/* The day or weekly hours are set in Conference (or Meeting) Setup only; these carry what's there now. */}
            <input type="hidden" name="startsOn" value={initial.startsOn ?? placeholderDay} />
            <input type="hidden" name="endsOn" value={initial.endsOn ?? placeholderDay} />
            <input type="hidden" name="startTime" value={initial.startTime ?? "15:00"} />
            <input type="hidden" name="endTime" value={initial.endTime ?? "19:00"} />
            {when ? (
              <div className="rounded-lg border border-border p-3 text-sm sm:col-span-2">
                <p className="font-medium">{when.summary}</p>
                <p className="mt-1 text-muted">
                  Change the day or hours, or switch between one day and every week, in{" "}
                  <Link href={when.href} className="font-medium text-brand underline underline-offset-4">
                    {when.setupName}
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-border p-3 text-sm text-muted sm:col-span-2">
                Next, you&apos;ll set your {meeting ? "meeting" : "conference"} day, or the same hours every week, in{" "}
                {meeting ? "Meeting Setup" : "Conference Setup"}.
              </p>
            )}
          </>
        ) : (
          <>
            <EventDates startsOn={initial.startsOn} endsOn={initial.endsOn} startTime={initial.startTime} endTime={initial.endTime} />
          </>
        )}
        <Field
          label="Event time zone"
          hint={
            conference
              ? `Where you'll meet. Every time ${meeting ? "people" : "families"} see, in emails, and in calendar invites uses this zone, whatever someone's phone is set to.`
              : "Where the event happens. Every time on volunteer pages, emails, and calendar invites uses this zone, whatever someone's phone is set to."
          }
          className="sm:col-span-2"
        >
          <Select name="timezone" required value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      {/* Conferences ask for the school in Conference Setup, with the room, and only for in-person meetings. */}
      {!conference && (
        <fieldset className="grid gap-4">
          <legend className="mb-3 w-full border-b border-border pt-2 pb-1 font-semibold">Where</legend>
          <VenuePicker searchEnabled={venueSearchEnabled} initial={initial.venue} timezone={timezone} {...(eventType && eventType !== "band_contest" ? { example: "e.g. Oak Hills Elementary" } : {})} />
        </fieldset>
      )}

      {eventType === "school_visit" && (
        <p className="rounded-md border border-border bg-brand-soft px-3 py-2 text-sm leading-6">
          🔒 <strong>Student privacy:</strong> parents enter their children&apos;s names, teachers, and grades. Only your
          event team can see them, and they&apos;re permanently deleted 30 days after the event ends. Parents are told
          this when they register.
        </p>
      )}

      {conference && !meeting && (
        <fieldset className="space-y-2">
          <legend className="mb-3 w-full border-b border-border pt-2 pb-1 font-semibold">Booking</legend>
          <input type="hidden" name="askChildNameField" value="1" />
          <label className="flex gap-3 rounded-lg border border-field-border p-3 text-sm leading-6">
            <input
              type="checkbox"
              name="askChildName"
              defaultChecked={initial.askChildName ?? true}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
            />
            <span>
              <span className="block font-semibold">Ask parents for their child&apos;s name</span>
              <span className="block text-muted">
                Turn this off and the booking page doesn&apos;t ask for it. Each family books one meeting, by the first
                parent&apos;s email.
              </span>
            </span>
          </label>
        </fieldset>
      )}

      {meeting && (
        <p className="rounded-md border border-border bg-brand-soft px-3 py-2 text-sm leading-6">
          🔒 <strong>Privacy:</strong> people see only the open times, never who else booked. Names, contact details, and
          notes are seen only by you and are permanently deleted 30 days after each meeting.
        </p>
      )}

      {conference && !meeting && (
        <p className="rounded-md border border-border bg-brand-soft px-3 py-2 text-sm leading-6">
          🔒 <strong>Family privacy:</strong> families see only the open times, never who else booked. Children&apos;s
          names and parents&apos; notes are seen only by you and are permanently deleted 30 days after the conference.
        </p>
      )}

      {extra}

      {setup ? (
        <>
          {setup.next && <input type="hidden" name="next" value={setup.next} />}
          <SetupFooter back={setup.back} inCard submit={<SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>} />
        </>
      ) : stickySave ? (
        // The same footer as a sign-up in Volunteer Setup.
        <div className="sticky bottom-[var(--day-bar,0px)] z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-b-lg border-t-2 border-border bg-surface px-4 py-3 shadow-[0_-6px_16px_rgb(0_0_0/0.10)] sm:-mx-6 sm:-mb-6 sm:px-6">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm" aria-live="polite">
            {dirty ? (
              <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[#f5b301] ring-1 ring-warning/50" />
            ) : (
              <span aria-hidden className="font-bold text-success">
                ✓
              </span>
            )}
            <span className="font-semibold">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          </p>
          <SubmitButton pendingText="Saving…" disabled={!dirty}>
            {submitLabel}
          </SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
      )}
    </ActionForm>
  );
}

/**
 * The event's days and hours. Most events are one day: one Date, with "Lasts
 * more than one day" for the rest. Until someone picks the last day, it
 * follows the first; it's never before it.
 */
function EventDates({ startsOn, endsOn, startTime, endTime }: { startsOn?: string; endsOn?: string; startTime?: string; endTime?: string }) {
  const [multi, setMulti] = useState(Boolean(startsOn && endsOn && endsOn !== startsOn));
  const [start, setStart] = useState(startsOn ?? "");
  const [end, setEnd] = useState(endsOn ?? startsOn ?? "");
  // Picked by hand (or saved that way): stays put when the first day changes, unless that passes it.
  const [endPicked, setEndPicked] = useState(multi);
  return (
    <>
      {/* The checkbox sits right under the date, level with the end date's hint. */}
      <div className="flex flex-col gap-1.5">
        <Field label={multi ? "Start date" : "Date"}>
          <Input
            name="startsOn"
            type="date"
            required
            value={start}
            onChange={(e) => {
              const day = e.target.value;
              setStart(day);
              if (!endPicked || !end || end < day) setEnd(day);
            }}
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={multi}
            onChange={(e) => {
              setMulti(e.target.checked);
              // Starting over: the last day starts as the first.
              setEndPicked(false);
              setEnd(start);
            }}
            className="h-4 w-4 shrink-0 accent-[var(--brand)]"
          />
          Lasts more than one day
        </label>
      </div>
      {multi ? (
        <Field label="End date" hint="Starts as the start date. Pick the last day.">
          <Input
            name="endsOn"
            type="date"
            required
            min={start || undefined}
            value={end}
            onChange={(e) => {
              const day = e.target.value;
              setEndPicked(true);
              setEnd(day && start && day < start ? start : day);
            }}
          />
        </Field>
      ) : (
        // One day: it ends the day it starts.
        <input type="hidden" name="endsOn" value={start} />
      )}
      {/* Always on a row of their own, under the dates. */}
      <Field label={multi ? "Start time (first day)" : "Start time"} className="sm:col-start-1">
        <Input name="startTime" type="time" defaultValue={startTime ?? "07:00"} required />
      </Field>
      <Field label={multi ? "End time (last day)" : "End time"}>
        <Input name="endTime" type="time" defaultValue={endTime ?? "22:00"} required />
      </Field>
    </>
  );
}
