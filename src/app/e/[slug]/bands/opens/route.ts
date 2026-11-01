import { type NextRequest } from "next/server";
import { opensLater } from "@/lib/bands";
import { buildIcs } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

// "Add to calendar" on a band contest's registration page before it opens: a 15-minute reminder
// at 8:00 AM on the opening day, linking back to the page. Only for a published event whose
// registration hasn't opened yet (the public can read published events).
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, timezone, band_registration_open, band_registration_opens_on, band_registration_deadline")
    .eq("slug", slug)
    .maybeSingle();
  if (!event || event.status !== "published" || !event.band_registration_open || !event.band_registration_opens_on || !opensLater(event)) {
    return new Response("Registration isn't waiting to open.", { status: 404 });
  }
  const start = zonedToUtc(event.band_registration_opens_on, "08:00", event.timezone);
  const ics = buildIcs("PUBLISH", {
    uid: `registration-opens-${event.id}`,
    timezone: event.timezone,
    sequence: 0,
    start,
    end: new Date(start.getTime() + 15 * 60_000),
    summary: `Register for ${event.name}`,
    description: `Band registration opens today.${event.band_registration_deadline ? ` It closes at the end of ${event.band_registration_deadline}.` : ""}`,
    url: `${request.nextUrl.origin}/e/${slug}/bands`,
    alarm: false,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-registration-opens.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
