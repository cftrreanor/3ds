import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { canUsePlaces } from "@/lib/places-access";
import { autocomplete, isPlacesConfigured } from "@/lib/places";

// Hosts and admins only (canUsePlaces): every call costs money on Google's side.
export async function GET(request: NextRequest) {
  if (!isPlacesConfigured) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await getUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canUsePlaces())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const session = request.nextUrl.searchParams.get("session") ?? "";
  // The event's time zone: suggestions favor that part of the country.
  const timezone = request.nextUrl.searchParams.get("tz") ?? undefined;
  if (q.length < 3 || q.length > 200 || !session) return NextResponse.json({ suggestions: [] });

  try {
    return NextResponse.json({ suggestions: await autocomplete(q, session, timezone) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
}
