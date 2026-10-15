import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupStep, StepStatus } from "@/components/setup-step";
import {
  DEFAULT_SETTINGS,
  meetingStarts,
  meetingSummary,
  modeLabel,
  notReady,
  placeMissing,
  SETTINGS_COLUMNS,
  type ConferenceSettings,
} from "@/lib/conferences";
import { getEventAccess } from "@/lib/data";
import { hasConferences } from "@/lib/event-types";
import { displayTime } from "@/lib/schedule";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedTime, zoneName } from "@/lib/time";
import { setEventPublished } from "../../../actions";
import { ActionButton } from "../forms";
import { saveMeetingPlace, saveMeetingTimes } from "./actions";
import { ConferencePublishBar, ConferenceSetup, MeetingPlaceForm, MeetingTimesForm } from "./conference-forms";

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
    .select("id, name, status, event_type, timezone, starts_on, window_start, window_end")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  if (!hasConferences(event.event_type)) redirect(`/dashboard/events/${eventId}`);

  const { data, error } = await supabase.from("conference_settings").select(SETTINGS_COLUMNS).eq("event_id", eventId).maybeSingle();
  if (error) missing();
  const saved = (data ?? null) as ConferenceSettings | null;
  const settings: ConferenceSettings = { ...DEFAULT_SETTINGS, ...saved, breaks: saved?.breaks ?? [] };

  const tz = event.timezone;
  const start = utcToZonedTime(event.window_start, tz);
  const end = utcToZonedTime(event.window_end, tz);
  const hours = `${displayTime(start)} – ${displayTime(end)}`;
  const starts = meetingStarts(start, end, settings);
  const timesDone = Boolean(saved?.times_saved_at);
  const placeTodo = placeMissing(saved);
  const published = event.status === "published";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Conference Setup</h1>
      <p className="mt-2 text-muted">
        {formatDate(event.starts_on)} · {hours} · All times {zoneName(tz)}.
      </p>

      <ConferenceSetup>
        <ConferencePublishBar published={published} missing={notReady(saved)}>
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
          status={<StepStatus done={timesDone} doneLabel={meetingSummary(starts, settings.meeting_minutes)} />}
          open={!timesDone}
          intro="How long each meeting is, and any breaks. Your hours are cut into meetings families can book."
        >
          <MeetingTimesForm
            action={saveMeetingTimes.bind(null, eventId)}
            initial={settings}
            day={formatDate(event.starts_on, { year: undefined, weekday: "long" })}
            start={start}
            end={end}
            editHref={`/dashboard/events/${eventId}/edit`}
          />
        </SetupStep>

        <SetupStep
          id="place"
          title="2. Where you'll meet"
          status={<StepStatus done={!placeTodo} doneLabel={modeLabel(settings.meeting_mode) ?? "Done"} />}
          open={timesDone && Boolean(placeTodo)}
          intro="Your room, a video link, or both. Either way, families wait until you're ready for them."
        >
          <MeetingPlaceForm action={saveMeetingPlace.bind(null, eventId)} initial={settings} hours={hours} />
        </SetupStep>
      </ConferenceSetup>
    </div>
  );
}
