import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getEventAccess } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { AUDIENCES, fileHref, fileMeta, isShowing, type EventFile } from "@/lib/event-files";
import { formatDate, utcToZonedTime } from "@/lib/time";
import { updateEvent } from "../../../actions";
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
      "id, organization_id, name, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, venue_place_id, venue_lat, venue_lng",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  const [{ count }, { data: fileData }] = await Promise.all([
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase
      .from("event_files")
      .select("id, event_id, label, path, file_name, content_type, size_bytes, audiences, visible_from")
      .eq("event_id", eventId)
      .order("created_at"),
  ]);
  const files = ((fileData ?? []) as EventFile[]).map((f) => ({
    id: f.id,
    label: f.label,
    meta: fileMeta(f),
    audiences: f.audiences,
    visibleFrom: f.visible_from,
    hiddenNote: isShowing(f, event.timezone) ? null : `Hidden until ${formatDate(f.visible_from!, { year: undefined })}`,
    href: fileHref(f.id),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Edit event details</h1>
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

      <section className="mt-10" aria-labelledby="files-heading">
        <h2 id="files-heading" className="text-lg font-semibold">
          Maps &amp; documents
        </h2>
        <p className="mt-1 text-sm text-muted">
          Share a stadium map, parking map or director packet. Choose who sees each one: the public page, band directors,
          volunteers or your team.
        </p>
        <Card className="mt-4">
          <FilesManager
            files={files}
            audiences={AUDIENCES}
            prepareUpload={prepareUpload.bind(null, eventId)}
            saveFile={saveFile.bind(null, eventId)}
            deleteFile={deleteFile.bind(null, eventId)}
          />
        </Card>
      </section>
    </div>
  );
}
