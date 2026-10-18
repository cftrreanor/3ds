"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { LOGO_BUCKET, LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/badges";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** The event's account, if the person signed in is one of its hosts. */
async function hostAccount(eventId: string) {
  const supabase = await createClient();
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
  eventId: string,
  file: { contentType: string; size: number },
): Promise<{ error?: string; path?: string; token?: string }> {
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
  return { path, token: data.token };
}

/** Step 2: use the uploaded image (or, with null, remove the logo). The old image is deleted. */
export async function saveLogo(eventId: string, path: string | null): Promise<{ error?: string }> {
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
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return {};
}
