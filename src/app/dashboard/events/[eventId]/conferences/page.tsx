import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupStep, StepStatus } from "@/components/setup-step";
import { meetingStarts, meetingSummary, modeLabel, notReady, placeMissing, weeklyMeetingCount, weeklySummary } from "@/lib/conferences";
import { loadConferenceSettings } from "@/lib/conference-settings";
import { getEventAccess } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { hasConferences } from "@/lib/event-types";
import { displayTime } from "@/lib/schedule";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, utcToZonedTime, zoneName } from "@/lib/time";
import { setEventPublished } from "../../../actions";
import { ActionButton } from "../forms";
import { saveMeetingPlace, saveMeetingTimes } from "./actions";
import { conferenceBookedCount } from "@/lib/conference-access";
import { ConferencePublishBar, ConferenceSetup, MeetingPlaceForm, MeetingTimesForm } from "./conference-forms";
import { SavedBy } from "@/components/saved-by";

export const metadata: Metadata = { title: "Conference Setup" };

/**
 * A teacher sets up their parent-teacher conferences in steps (see "Setup
 * pages" in docs/DESIGN.md): 1. meeting times, 2. where they'll meet.
 */
export default async function ConferencesPage({ params }: PageProps<"/dashboard/events/[eventId]/conferences">) {
  const { eventId } = await params;
  const access = await getEventAccess(eventId);
  if (!access.isHost) redirect(`/dashboard/events/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, organization_id, name, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, venue_place_id, venue_lat, venue_lng")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  if (!hasConferences(event.event_type)) redirect(`/dashboard/events/${eventId}`);

  const { saved, settings, error } = await loadConferenceSettings(supabase, eventId);
  if (error) missing();

  const tz = event.timezone;
  const start = utcToZonedTime(event.window_start, tz);
  const end = utcToZonedTime(event.window_end, tz);
  const weekly = settings.schedule === "weekly";
  const hours = weekly ? "during your weekly hours" : `${displayTime(start)} – ${displayTime(end)}`;
  const starts = meetingStarts(start, end, settings);
  const perWeek = weeklyMeetingCount(settings.weekly_hours, settings);
  const timesDone = Boolean(saved?.times_saved_at);
  const [booked, { data: premium }] = await Promise.all([
    conferenceBookedCount(supabase, eventId),
    supabase.rpc("org_has_active_plan", { org: event.organization_id }),
  ]);
  const placeTodo = placeMissing(saved, event.venue_address);
  const published = event.status === "published";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Conference Setup</h1>
      <SavedBy eventId={eventId} area="conference" className="mt-2" />
      <p className="mt-2 text-muted">
        {weekly
          ? `${weeklySummary(settings.weekly_hours)} · ${formatDateRange(event.starts_on, event.ends_on)}`
          : `${formatDate(event.starts_on)} · ${hours}`}{" "}
        · All times are {zoneName(tz)}.
      </p>

      <ConferenceSetup>
        <ConferencePublishBar
          published={published}
          missing={
            notReady(saved, event.venue_address) ??
            (weekly && premium !== true ? "Weekly hours are a premium feature. Write to us to add them to your account." : null)
          }
        >
          {published ? (
            <ActionButton
              action={setEventPublished.bind(null, eventId, false)}
              variant="stop"
              pendingText="Unpublishing…"
              confirmMessage="Unpublish your conference? Your public page will be hidden. You can publish again anytime."
            >
              Unpublish
            </ActionButton>
          ) : (
            <ActionButton action={setEventPublished.bind(null, eventId, true)} variant="go" pendingText="Publishing…">
              Publish
            </ActionButton>
          )}
        </ConferencePublishBar>

        <SetupStep
          id="times"
          title="1. Meeting times"
          status={
            <StepStatus
              done={timesDone}
              doneLabel={weekly ? `Every week · ${perWeek} ${perWeek === 1 ? "meeting" : "meetings"} each week` : meetingSummary(starts, settings.meeting_minutes)}
            />
          }
          open={!timesDone}
          intro="One day or the same times every week, how long each meeting is, and any breaks. Your hours are cut into meetings families can book."
        >
          <MeetingTimesForm
            action={saveMeetingTimes.bind(null, eventId)}
            initial={settings}
            date={event.starts_on}
            endDate={event.ends_on}
            start={start}
            end={end}
            booked={booked}
            premium={premium === true}
          />
        </SetupStep>

        <SetupStep
          id="place"
          title="2. Where you'll meet"
          status={<StepStatus done={!placeTodo} doneLabel={modeLabel(settings.meeting_mode) ?? "Done"} />}
          open={timesDone && Boolean(placeTodo)}
          intro="Your room, a video link, or a phone call. Families wait until you're ready for them, or you call them."
        >
          <MeetingPlaceForm
            action={saveMeetingPlace.bind(null, eventId)}
            initial={settings}
            hours={hours}
            venue={{
              name: event.venue_name,
              address: event.venue_address,
              placeId: event.venue_place_id,
              lat: event.venue_lat,
              lng: event.venue_lng,
            }}
            venueSearchEnabled={isPlacesConfigured}
            timezone={tz}
          />
        </SetupStep>
      </ConferenceSetup>
    </div>
  );
}
