import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { autocomplete, isPlacesConfigured } from "@/lib/places";

// Signed-in users only: every call costs money on Google's side.
export async function GET(request: NextRequest) {
  if (!isPlacesConfigured) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await getUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const session = request.nextUrl.searchParams.get("session") ?? "";
  if (q.length < 3 || q.length > 200 || !session) return NextResponse.json({ suggestions: [] });

  try {
    return NextResponse.json({ suggestions: await autocomplete(q, session) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
}
