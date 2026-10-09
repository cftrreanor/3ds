import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { eventTypeLabel, hasBands } from "@/lib/event-types";
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

export default async function EditEventPage({ params }: PageProps<"/dashboard/events/[eventId]/edit">) {
  const { eventId } = await params;
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
  const [{ count }, { data: fileData }, { count: bandCount }] = await Promise.all([
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase
      .from("event_files")
      .select("id, event_id, label, path, file_name, content_type, size_bytes, audiences, visible_from, uploaded_by, uploaded_at")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("bands").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  const bandsHere = hasBands(event.event_type);
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
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Edit event details</h1>
      <Card className="mt-8">
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
        />
      </Card>

      <section className="mt-10" aria-labelledby="type-heading">
        <h2 id="type-heading" className="text-xl font-semibold">
          Kind of event
        </h2>
        <Card className="mt-4 space-y-3">
          <p>
            This is a <strong>{eventTypeLabel(event.event_type).toLowerCase()}</strong>.{" "}
            <span className="text-muted">
              {bandsHere
                ? "Bands register, get performance times and are checked in on contest day, alongside your volunteers."
                : "Volunteers, shifts, check-in and your team only. No band registration or performance schedule."}
            </span>
          </p>
          {bandsHere && (bandCount ?? 0) > 0 ? (
            <p className="text-sm text-muted">
              {bandCount} band{bandCount === 1 ? " has" : "s have"} registered, so this has to stay a band contest.
            </p>
          ) : (
            <ActionButton
              action={setEventType.bind(null, eventId, bandsHere ? "volunteer" : "band_contest")}
              variant="secondary"
              confirmMessage={
                bandsHere
                  ? "Make this a volunteer event? Band registration and the performance schedule go away, and band check-in stations become ordinary stations. Volunteers and shifts stay as they are."
                  : "Make this a band contest? Band registration, the performance schedule and contest day check-in are added. Volunteers and shifts stay as they are."
              }
            >
              {bandsHere ? "Make it a volunteer event" : "Make it a band contest"}
            </ActionButton>
          )}
        </Card>
      </section>

      <section className="mt-10" aria-labelledby="files-heading">
        <h2 id="files-heading" className="text-xl font-semibold">
          Maps &amp; documents
        </h2>
        <p className="mt-1 text-sm text-muted">
          {bandsHere
            ? "Share a stadium map, parking map or director packet. Choose who sees each one: the public page, band directors, volunteers or your team."
            : "Share a site map, parking map or volunteer guide. Choose who sees each one: the public page, volunteers or your team."}
        </p>
        <Card className="mt-4">
          <FilesManager
            files={files}
            audiences={bandsHere ? AUDIENCES : AUDIENCES.filter((a) => a.value !== "directors")}
            prepareUpload={prepareUpload.bind(null, eventId)}
            saveFile={saveFile.bind(null, eventId)}
            deleteFile={deleteFile.bind(null, eventId)}
          />
        </Card>
      </section>
    </div>
  );
}
