import { type NextRequest } from "next/server";
import { buildIcs } from "@/lib/ics";
import { createAdminClient } from "@/lib/supabase/server";
import { loadCalendarEntries, toIcsEvent } from "@/lib/volunteer-emails";

// "Apple / Outlook calendar" button: downloads one shift as a calendar file.
// The token is the signup's private manage token, so only the volunteer has it.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Not found", { status: 404 });

  const { data } = await createAdminClient()
    .from("volunteer_assignments")
    .select("id")
    .eq("manage_token", token)
    .maybeSingle();
  const [entry] = data ? await loadCalendarEntries([data.id]) : [];
  if (!entry) return new Response("This shift is no longer on the schedule.", { status: 404 });

  // PUBLISH: a plain "add this event". The same UID as the emailed invite means
  // calendars treat it as the same event rather than a duplicate.
  const ics = buildIcs("PUBLISH", toIcsEvent(entry, request.nextUrl.origin));
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="volunteer-shift.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
