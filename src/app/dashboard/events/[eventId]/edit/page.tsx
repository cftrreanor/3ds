import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupStep, StepStatus } from "@/components/setup-step";
import { EVENT_TYPES, eventTypeLabel, groupWords, hasBands, hasBooths, hasConferences, hasEnsembles, hasParents } from "@/lib/event-types";
import { ActionButton } from "../forms";
import { getEventAccess } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { AUDIENCES, fileHref, fileMeta, isShowing, uploadedLines, type EventFile } from "@/lib/event-files";
import { formatDate, utcToZonedTime } from "@/lib/time";
import { setEventType, updateEvent } from "../../../actions";
import { deleteFile, prepareUpload, saveFile } from "../../../file-actions";
import { FilesManager } from "./files-manager";
import { EventForm } from "../../_components/event-form";

export const metadata: Metadata = { title: "Edit event" };

const TYPE_SUMMARY = {
  band_contest: "Bands register, get performance times, and are checked in on contest day, alongside your volunteers.",
  group_event: "Groups (choirs, orchestras, teams, and more) register and move through your rooms on a schedule worked out for them, alongside your volunteers.",
  volunteer: "Volunteers, shifts, check-in, and your team only. No band registration or performance schedule.",
  school_visit: "Parents register their children ahead and are checked in at the door with a photo ID, alongside your volunteers. Children's details are seen only by your team and permanently deleted 30 days after the event.",
  conference: "Families book a meeting time with you, in person or on video. Free: you can have one published conference at a time.",
};

// What switching to each kind adds or removes.
const SWITCH_NOTE = {
  band_contest: "Band registration, the performance schedule, and contest day check-in are added.",
  group_event: "Group registration, rooms, and each group's room schedule are added; the single performance order and band check-in stations go away.",
  volunteer: "Band registration, parent registration, and the performance schedule go away; band check-in stations become ordinary stations.",
  school_visit: "Parent registration and door check-in are added (children's details are deleted 30 days after the event); band registration and the performance schedule go away.",
  fair: "Booths and partners by zone, partner check-in, and the public \u201cWhat's at the event\u201d list are added; band registration and the performance schedule go away.",
};

/** Edit details, as setup steps (see "Setup pages" in docs/DESIGN.md). ?step=files opens Maps & documents. */
export default async function EditEventPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/edit">) {
  const { eventId } = await params;
  const { step } = await searchParams;
  const access = await getEventAccess(eventId);
  if (!access.isHost) redirect(`/dashboard/events/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organization_id, name, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, venue_place_id, venue_lat, venue_lng",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  const [{ count }, { data: fileData }, { count: bandCount }, { count: parentCount }, { count: boothCount }] = await Promise.all([
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase
      .from("event_files")
      .select("id, event_id, label, path, file_name, content_type, size_bytes, audiences, visible_from, uploaded_by, uploaded_at")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("bands").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("parent_registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("fair_booths").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  const bandsHere = hasBands(event.event_type);
  const groupsHere = hasEnsembles(event.event_type);
  const words = groupWords(event.event_type);
  const fileRows = (fileData ?? []) as (EventFile & { uploaded_by: string | null; uploaded_at: string })[];
  const uploaded = await uploadedLines(fileRows, event.timezone);
  const files = fileRows.map((f) => ({
    id: f.id,
    label: f.label,
    meta: fileMeta(f),
    audiences: f.audiences,
    visibleFrom: f.visible_from,
    hiddenNote: isShowing(f, event.timezone) ? null : `Hidden until ${formatDate(f.visible_from!, { year: undefined })}`,
    href: fileHref(f.id),
    uploaded: uploaded.get(f.id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Edit event details</h1>
      <div className="mt-6 flex flex-col gap-3">
        <SetupStep
          id="details"
          title="1. Event details"
          status={<StepStatus done doneLabel="Saved" />}
          open={step !== "files" && step !== "kind"}
          intro="The name, dates, times, and venue everyone sees."
        >
          <EventForm
            action={updateEvent.bind(null, eventId)}
            organizationId={event.organization_id}
            initial={{
              name: event.name,
              startsOn: event.starts_on,
              endsOn: event.ends_on,
              startTime: utcToZonedTime(event.window_start, event.timezone),
              endTime: utcToZonedTime(event.window_end, event.timezone),
              timezone: event.timezone,
              venue: {
                name: event.venue_name,
                address: event.venue_address,
                placeId: event.venue_place_id,
                lat: event.venue_lat,
                lng: event.venue_lng,
              },
            }}
            venueSearchEnabled={isPlacesConfigured}
            submitLabel="Save changes"
            hasShifts={(count ?? 0) > 0}
            eventType={event.event_type}
          />
        </SetupStep>

        <SetupStep
          id="files"
          title="2. Maps & documents"
          status={<StepStatus done={files.length > 0} doneLabel={`${files.length} ${files.length === 1 ? "file" : "files"}`} todoLabel="Optional" />}
          open={step === "files"}
          intro={
            groupsHere
              ? `Share a ${bandsHere ? "stadium" : "building"} map, parking map, or director packet. Choose who sees each one: the public page, ${words.one} directors, volunteers, or your team.`
              : "Share a site map, parking map, or volunteer guide. Choose who sees each one: the public page, volunteers, or your team."
          }
        >
          <FilesManager
            files={files}
            audiences={groupsHere ? AUDIENCES : AUDIENCES.filter((a) => a.value !== "directors")}
            prepareUpload={prepareUpload.bind(null, eventId)}
            saveFile={saveFile.bind(null, eventId)}
            deleteFile={deleteFile.bind(null, eventId)}
            canNotify={bandsHere}
          />
        </SetupStep>

        <SetupStep
          id="kind"
          title="3. Kind of event"
          status={<StepStatus done doneLabel={eventTypeLabel(event.event_type)} />}
          open={step === "kind"}
          intro="What the event is for decides which pages and tools it has."
        >
          <div className="space-y-3">
            <p>
              This is a <strong>{hasConferences(event.event_type) ? "parent-teacher conference" : eventTypeLabel(event.event_type).toLowerCase()}</strong>.{" "}
              <span className="text-muted">{TYPE_SUMMARY[event.event_type as keyof typeof TYPE_SUMMARY] ?? TYPE_SUMMARY.band_contest}</span>
            </p>
            {hasConferences(event.event_type) ? (
              <p className="text-sm text-muted">A conference stays a conference. For another kind of event, create a new one.</p>
            ) : groupsHere && (bandCount ?? 0) > 0 ? (
              <p className="text-sm text-muted">
                {bandCount} {bandCount === 1 ? `${words.one} has` : `${words.many} have`} registered, so this has to stay a{" "}
                {eventTypeLabel(event.event_type).toLowerCase()}.
              </p>
            ) : hasBooths(event.event_type) && (boothCount ?? 0) > 0 ? (
              <p className="text-sm text-muted">This fair has booths and partners, so it has to stay a school fair.</p>
            ) : hasParents(event.event_type) && (parentCount ?? 0) > 0 ? (
              <p className="text-sm text-muted">
                {parentCount} parent{parentCount === 1 ? " has" : "s have"} registered, so this has to stay a school visitor event.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.filter((t) => t.value !== (event.event_type ?? "band_contest") && t.value !== "conference").map((t) => (
                  <ActionButton
                    key={t.value}
                    action={setEventType.bind(null, eventId, t.value)}
                    variant="secondary"
                    confirmMessage={`Make this a ${t.label.toLowerCase()}? ${SWITCH_NOTE[t.value as keyof typeof SWITCH_NOTE]} Volunteers and shifts stay as they are.`}
                  >
                    Make it a {t.label.toLowerCase()}
                  </ActionButton>
                ))}
              </div>
            )}
          </div>
        </SetupStep>
      </div>
    </div>
  );
}
