import QRCode from "qrcode";
import type { Share } from "@/lib/action-state";
import { getOrigin } from "@/lib/data";
import type { EventType } from "@/lib/event-types";
import { createClient } from "@/lib/supabase/server";

/**
 * The link to share after something goes public (an event, a sign-up, a
 * registration, a schedule), with its QR code, for the share window.
 */
export async function shareLink(title: string, path: string, note?: string): Promise<Share> {
  const url = `${await getOrigin()}${path}`;
  const qr = await QRCode.toDataURL(url, { margin: 2, width: 1024 }).catch(() => undefined);
  const qrName = `${path.replace(/^\/e\//, "").replace(/\//g, "-")}-qr.png`;
  return { title, note, url, qr, qrName };
}

/** An event's public address and type, for its share links. */
export async function eventForShare(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("slug, event_type").eq("id", eventId).maybeSingle();
  return data as { slug: string; event_type: EventType } | null;
}
