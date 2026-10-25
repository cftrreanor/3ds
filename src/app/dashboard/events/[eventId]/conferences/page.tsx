import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupStep, StepStatus } from "@/components/setup-step";
import { meetingStarts, meetingSummary, modesLabel, modesOf, notReady, placeMissing, weeklyMeetingCount, weeklySummary } from "@/lib/conferences";
import { loadConferenceSettings } from "@/lib/conference-settings";
import { getEventAccess } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { hasConferences, isMeeting } from "@/lib/event-types";
import { displayTime } from "@/lib/schedule";
import { loadAccountPlan } from "@/lib/plan";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, utcToZonedTime, zoneName } from "@/lib/time";
import { setEventPublished } from "../../../actions";
import { ActionButton } from "../forms";
import { saveMeetingPlace, saveMeetingTimes } from "./actions";
import { conferenceBookedCount } from "@/lib/conference-access";
import { ConferencePublishBar, ConferenceSetup, MeetingPlaceForm, MeetingTimesForm } from "./conference-forms";
import { SavedBy } from "@/components/saved-by";

export const metadata: Metadata = { title: "Setup" };

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
  const meeting = isMeeting(event.event_type);
  const who = meeting ? "people" : "families";

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
  const published = event.status === "published";
  const [booked, plan, { data: planReason }] = await Promise.all([
    conferenceBookedCount(supabase, eventId),
    loadAccountPlan(supabase, event.organization_id),
    // Why the plan won't let it publish (weekly hours, one at a time...), or null.
    published ? Promise.resolve({ data: null }) : supabase.rpc("org_can_publish", { p_event: eventId }),
  ]);
  const weeklyIncluded = plan?.weekly_hours ?? true;
  const placeTodo = placeMissing(saved, event.venue_address, event.event_type);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">{meeting ? "Meeting Setup" : "Conference Setup"}</h1>
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
          meeting={meeting}
          missing={
            notReady(saved, event.venue_address, event.event_type) ?? (typeof planReason === "string" ? planReason : null)
          }
        >
          {published ? (
            <ActionButton
              action={setEventPublished.bind(null, eventId, false)}
              variant="stop"
              pendingText="Unpublishing…"
              confirmMessage={`Unpublish your ${meeting ? "meetings" : "conference"}? Your public page will be hidden. You can publish again anytime.`}
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
          intro={`One day or the same times every week, how long each meeting is, and any breaks. Your hours are cut into meetings ${who} can book.`}
        >
          <MeetingTimesForm
            action={saveMeetingTimes.bind(null, eventId)}
            initial={settings}
            date={event.starts_on}
            endDate={event.ends_on}
            start={start}
            end={end}
            booked={booked}
            weeklyIncluded={weeklyIncluded}
            planName={plan?.active_name ?? null}
            meeting={meeting}
          />
        </SetupStep>

        <SetupStep
          id="place"
          title="2. Where you'll meet"
          status={<StepStatus done={!placeTodo} doneLabel={modesLabel(modesOf(settings)) ?? "Done"} />}
          open={timesDone && Boolean(placeTodo)}
          intro={`Your room, a video link, phone calls, or any mix. ${meeting ? "People" : "Families"} wait until you're ready for them, or you call them.`}
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
            meeting={meeting}
          />
        </SetupStep>
      </ConferenceSetup>
    </div>
  );
}
