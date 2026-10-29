"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { LOGO_BUCKET, LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/badges";
import { isHexColor } from "@/lib/brand-color";
import { getMyOrganization } from "@/lib/data";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * The event's account, if the person signed in is one of its hosts. Without
 * an event yet (a new event's first step): their own account, if they're one
 * of its Account Hosts.
 */
async function hostAccount(eventId: string | null) {
  const supabase = await createClient();
  if (!eventId) {
    const org = await getMyOrganization();
    if (!org) return null;
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { org: org.id });
    return isAdmin ? org.id : null;
  }
  const [{ data: event }, { data: isHost }] = await Promise.all([
    supabase.from("events").select("organization_id").eq("id", eventId).maybeSingle(),
    supabase.rpc("is_event_admin", { ev: eventId }),
  ]);
  return isHost && event ? (event.organization_id as string) : null;
}

/**
 * Step 1 of adding a logo: a one-time upload link into the account's own
 * folder. The browser sends the image straight to storage.
 */
export async function prepareLogoUpload(
  eventId: string | null,
  file: { contentType: string; size: number },
): Promise<{ error?: string; path?: string; url?: string }> {
  await requireUser();
  if (!(LOGO_TYPES as readonly string[]).includes(file.contentType)) return { error: "Please choose a PNG or JPG image." };
  if (file.size < 1 || file.size > MAX_LOGO_BYTES) return { error: "That image is over 2 MB. Try a smaller one." };
  const org = await hostAccount(eventId);
  if (!org) return { error: "Only hosts can change the logo." };
  const path = `${org}/${crypto.randomUUID()}.${file.contentType === "image/png" ? "png" : "jpg"}`;
  const { data, error } = await createAdminClient().storage.from(LOGO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl failed", error);
    return { error: "We couldn't start the upload. Please try again." };
  }
  return { path, url: data.signedUrl };
}

/** Step 2: use the uploaded image (or, with null, remove the logo). The old image is deleted. */
export async function saveLogo(eventId: string | null, path: string | null): Promise<{ error?: string }> {
  await requireUser();
  const org = await hostAccount(eventId);
  if (!org) return { error: "Only hosts can change the logo." };
  const supabase = await createClient();
  const { data: old, error } = await supabase.rpc("set_org_logo", { p_org: org, p_path: path });
  if (error) {
    console.error("set_org_logo failed", error);
    if (error.code === "PGRST202" || error.code === "42883") return { error: "A database update is needed before logos can be saved." };
    return { error: "We couldn't save the logo. Please try again." };
  }
  if (old && old !== path) await createAdminClient().storage.from(LOGO_BUCKET).remove([old as string]);
  revalidatePath(eventId ? `/dashboard/events/${eventId}` : "/dashboard/events/new", "layout");
  return {};
}

/** The account's color (from the logo, or picked by the host); null goes back to none. */
export async function saveBrandColor(eventId: string | null, color: string | null): Promise<{ error?: string }> {
  await requireUser();
  if (color !== null && !isHexColor(color)) return { error: "Please pick a color." };
  const org = await hostAccount(eventId);
  if (!org) return { error: "Only hosts can change the color." };
  const { error } = await (await createClient()).rpc("set_org_brand_color", { p_org: org, p_color: color });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return { error: "A database update is needed before the color can be saved." };
    console.error("set_org_brand_color failed", error);
    return { error: "We couldn't save the color. Please try again." };
  }
  revalidatePath(eventId ? `/dashboard/events/${eventId}` : "/dashboard/events/new", "layout");
  return {};
}
