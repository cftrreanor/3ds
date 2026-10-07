import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { canOpen, FILES_BUCKET, type EventFile } from "@/lib/event-files";
import { createAdminClient } from "@/lib/supabase/server";

// Opens a shared map or document: checks the person may see it, then sends
// them to a link that works for a minute (long enough to start the download).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = () => new NextResponse("This file isn't available. Ask the event's host for a new link.", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("event_files")
    .select("id, event_id, label, path, file_name, content_type, size_bytes, audiences, visible_from, events(id, status, timezone)")
    .eq("id", id)
    .maybeSingle();
  const event = (data?.events ?? null) as unknown as { id: string; status: string; timezone: string } | null;
  if (!data || !event) return notFound();

  if (!(await canOpen(data as unknown as EventFile, event))) {
    // Directors and the team just need to sign in; volunteers open it from their shifts page.
    if (!(await getUser())) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/files/${id}`)}`, request.nextUrl.origin));
    }
    return notFound();
  }

  const { data: signed } = await admin.storage.from(FILES_BUCKET).createSignedUrl(data.path, 60);
  if (!signed?.signedUrl) return notFound();
  return NextResponse.redirect(signed.signedUrl);
}
