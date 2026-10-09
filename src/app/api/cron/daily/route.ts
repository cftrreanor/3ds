import { NextResponse, type NextRequest } from "next/server";
import { getOrigin } from "@/lib/data";
import { pause, sendEmail } from "@/lib/email";
import { adultNames, parentEmail, parentLink, type Child } from "@/lib/parents";
import { createAdminClient } from "@/lib/supabase/server";
import { utcToZonedDate } from "@/lib/time";

// Once a day (vercel.json): remind parents to bring their photo ID the day
// before a school visitor event, and erase parent registrations 30 days after
// their event. Vercel calls it with the CRON_SECRET environment variable.

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const started = Date.now();

  const { data: purged, error: purgeError } = await admin.rpc("purge_parent_registrations");
  if (purgeError) console.error("purge_parent_registrations failed", purgeError);

  // Events starting tomorrow in their own time zone (look a day either side, then check).
  const shift = (days: number) => new Date(started + days * 86_400_000).toISOString().slice(0, 10);
  const { data: events, error: eventsError } = await admin
    .from("events")
    .select("id, slug, name, starts_on, ends_on, window_start, window_end, timezone, venue_name, venue_address")
    .eq("event_type", "school_visit")
    .eq("status", "published")
    .gte("starts_on", shift(0))
    .lte("starts_on", shift(2));
  if (eventsError) console.error("Daily job: events lookup failed", eventsError);
  const tomorrow = (events ?? []).filter((e) => {
    const local = utcToZonedDate(new Date(started).toISOString(), e.timezone);
    const next = new Date(`${local}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return e.starts_on === next.toISOString().slice(0, 10);
  });

  // Vercel sets this to the site's main address (the custom domain, once there is one).
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = production ? `https://${production}` : await getOrigin();
  let reminded = 0;
  let unsent = 0;
  for (const event of tomorrow) {
    const { data: regs } = await admin
      .from("parent_registrations")
      .select("id, parent_name, email, children, other_adults, access_token, calendar_sequence")
      .eq("event_id", event.id)
      .is("reminded_at", null);
    for (const r of regs ?? []) {
      // Leave time to finish; whoever's left is counted as unsent.
      if (Date.now() - started > 270_000) {
        unsent++;
        continue;
      }
      const { subject, html, text } = parentEmail(
        "reminder",
        { ...r, children: r.children as Child[], other_adults: adultNames(r.other_adults) },
        event,
        parentLink(origin, event.slug, r.access_token),
      );
      if (await sendEmail({ to: r.email, subject, html, text })) {
        await admin.from("parent_registrations").update({ reminded_at: new Date().toISOString() }).eq("id", r.id);
        reminded++;
      } else {
        unsent++;
      }
      await pause();
    }
  }
  if (unsent) console.error(`Daily job: ${unsent} parent reminder(s) not sent`);

  return NextResponse.json({ purged: purged ?? 0, reminded, unsent });
}
