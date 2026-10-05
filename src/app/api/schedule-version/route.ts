import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Open schedule pages poll this to learn whether the schedule changed since
// they loaded. Returns only a timestamp, and only for published events.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) return Response.json({ v: null }, { status: 400 });
  const { data } = await (await createClient()).rpc("schedule_version", { p_slug: slug });
  return Response.json({ v: data ?? null }, { headers: { "Cache-Control": "no-store" } });
}
