import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { canUsePlaces } from "@/lib/places-access";
import { isPlacesConfigured, placeDetails } from "@/lib/places";

export async function GET(request: NextRequest) {
  if (!isPlacesConfigured) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await getUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canUsePlaces())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  const session = request.nextUrl.searchParams.get("session") ?? "";
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(id) || !session) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    return NextResponse.json({ place: await placeDetails(id, session) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
}
