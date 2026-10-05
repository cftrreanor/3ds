import { type NextRequest } from "next/server";
import { bandCalendarEvent } from "@/lib/band-calendar";
import { buildIcs } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

// "Apple / Outlook calendar" button on a band's contest page. Runs as the
// signed-in director, so the database only hands over published times.
export async function GET(request: NextRequest, { params }: { params: Promise<{ bandId: string }> }) {
  const { bandId } = await params;
  const round = request.nextUrl.searchParams.get("round") === "finals" ? "finals" : "order";
  const supabase = await createClient();
  const { data: band } = await supabase.from("bands").select("id, band_name, event_id").eq("id", bandId).maybeSingle();
  if (!band) return new Response("Not found", { status: 404 });

  const [{ data: event }, { data: times }] = await Promise.all([
    supabase.from("events").select("name, timezone, venue_name, venue_address, ready_minutes_before, finals_ready_minutes_before").eq("id", band.event_id).single(),
    supabase
      .from(round === "finals" ? "finals_slots" : "performance_slots")
      .select("warm_up_at, warm_up_minutes, perform_at, warm_up_location")
      .eq("band_id", bandId)
      .maybeSingle(),
  ]);
  const ics =
    event && times
      ? bandCalendarEvent({
          bandId,
          bandName: band.band_name,
          round,
          times,
          event: { ...event, ready_minutes_before: round === "finals" ? event.finals_ready_minutes_before : event.ready_minutes_before },
          url: `${request.nextUrl.origin}/dashboard/bands/${bandId}`,
        })
      : null;
  if (!ics) return new Response("Times haven't been posted yet.", { status: 404 });

  return new Response(buildIcs("PUBLISH", ics), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${round === "finals" ? "finals" : "performance"}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
