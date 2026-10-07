"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { getOrigin } from "@/lib/data";
import { emailLayout, pause, sendEmail } from "@/lib/email";
import { AUDIENCES, FILE_TYPES, FILES_BUCKET, fileHref, MAX_FILE_BYTES } from "@/lib/event-files";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { manageUrl } from "@/lib/volunteer-emails";

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(FILE_TYPES),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
});

async function isHost(eventId: string) {
  const supabase = await createClient();
  return Boolean((await supabase.rpc("is_event_admin", { ev: eventId })).data);
}

/**
 * Step 1 of adding or replacing a file: a one-time upload link. The browser
 * sends the file straight to storage (big PDFs don't fit through our server).
 */
export async function prepareUpload(
  eventId: string,
  file: { fileName: string; contentType: string; size: number },
): Promise<{ error?: string; path?: string; token?: string }> {
  await requireUser();
  const parsed = uploadSchema.safeParse(file);
  if (!parsed.success) {
    return {
      error:
        file.size > MAX_FILE_BYTES
          ? "That file is over 10 MB. Try a smaller PDF or a photo."
          : "Please choose a PDF, JPG or PNG file.",
    };
  }
  if (!(await isHost(eventId))) return { error: "Only hosts can add files." };
  const safeName = parsed.data.fileName.replace(/[^\w.-]+/g, "-").slice(-80);
  const path = `${eventId}/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await createAdminClient().storage.from(FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl failed", error);
    return { error: "We couldn't start the upload. Please try again." };
  }
  return { path, token: data.token };
}

const detailsSchema = z.object({
  label: z.string().trim().min(1, "Please give the file a name, like “Stadium & parking map”.").max(120),
  audiences: z.array(z.enum(AUDIENCES.map((a) => a.value) as [string, ...string[]])).min(1, "Choose who can see it."),
  visibleFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
});

export type UploadedFile = { path: string; fileName: string; contentType: string; size: number };

/** Step 2: save the file's details (and the uploaded file, if there's a new one). */
export async function saveFile(
  eventId: string,
  fileId: string | null,
  uploaded: UploadedFile | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = detailsSchema.safeParse({
    label: formData.get("label"),
    audiences: formData.getAll("audiences").map(String),
    visibleFrom: String(formData.get("visibleFrom") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (!fileId && !uploaded) return { error: "Please choose a file to upload." };
  if (uploaded) {
    const ok = uploadSchema.safeParse({ fileName: uploaded.fileName, contentType: uploaded.contentType, size: uploaded.size });
    if (!ok.success || !uploaded.path.startsWith(`${eventId}/`)) return { error: "Something went wrong with the upload. Please try again." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const fileFields = uploaded
    ? { path: uploaded.path, file_name: uploaded.fileName, content_type: uploaded.contentType, size_bytes: uploaded.size }
    : {};
  const fields = { label: v.label, audiences: v.audiences, visible_from: v.visibleFrom || null, ...fileFields };

  let savedId = fileId;
  if (fileId) {
    const { data: before } = await supabase.from("event_files").select("path").eq("id", fileId).maybeSingle();
    if (!before) return { error: "You don't have permission to do that." };
    const { error } = await supabase
      .from("event_files")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", fileId);
    if (error) return { error: friendlyDbError(error) };
    // Replaced: the old copy goes.
    if (uploaded && before.path !== uploaded.path) await admin.storage.from(FILES_BUCKET).remove([before.path]);
  } else {
    const { data, error } = await supabase
      .from("event_files")
      .insert({ event_id: eventId, created_by: user.id, ...fields })
      .select("id")
      .single();
    if (error) {
      await admin.storage.from(FILES_BUCKET).remove([uploaded!.path]);
      return { error: friendlyDbError(error) };
    }
    savedId = data.id;
  }

  // Optional heads-up emails, sent after the page responds.
  const notifyDirectors = formData.get("notifyDirectors") === "on" && v.audiences.some((a) => a === "directors" || a === "public");
  const notifyVolunteers = formData.get("notifyVolunteers") === "on" && v.audiences.some((a) => a === "volunteers" || a === "public");
  if ((notifyDirectors || notifyVolunteers) && savedId) {
    const origin = await getOrigin();
    const id = savedId;
    after(() => notify(eventId, id, v.label, Boolean(fileId), { directors: notifyDirectors, volunteers: notifyVolunteers }, origin));
  }

  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  const told = [notifyDirectors && "directors", notifyVolunteers && "volunteers"].filter(Boolean).join(" and ");
  return { ok: true, message: `Saved${told ? `. We're emailing ${told} now` : ""}.` };
}

export async function deleteFile(eventId: string, fileId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_files").delete().eq("id", fileId).select("path");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You don't have permission to do that." };
  await createAdminClient().storage.from(FILES_BUCKET).remove(data.map((d) => d.path));
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

async function notify(
  eventId: string,
  fileId: string,
  label: string,
  replaced: boolean,
  who: { directors: boolean; volunteers: boolean },
  origin: string,
) {
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("name, starts_on").eq("id", eventId).single();
  if (!event) return;
  const heading = `${replaced ? "Updated" : "New"}: ${label}`;
  const intro = `${replaced ? "An updated" : "A new"} file was shared for ${event.name} (${formatDate(event.starts_on)}).`;

  if (who.directors) {
    // The accounts that registered the bands: they're the ones who can sign in and open it.
    const { data: bands } = await admin.from("bands").select("director_user_id").eq("event_id", eventId);
    const ids = [...new Set((bands ?? []).map((b) => b.director_user_id).filter(Boolean))];
    const { data: people } = ids.length ? await admin.from("profiles").select("email").in("id", ids) : { data: [] };
    const emails = [...new Set((people ?? []).map((p) => p.email as string).filter(Boolean))];
    for (const to of emails) {
      const { html, text } = emailLayout({
        heading,
        paragraphs: [intro, "Sign in with the email you registered your band with to open it."],
        button: { label: `Open ${label}`, url: `${origin}${fileHref(fileId)}` },
      });
      await sendEmail({ to, subject: `${heading} · ${event.name}`, html, text });
      await pause();
    }
  }
  if (who.volunteers) {
    const { data: vols } = await admin
      .from("volunteers")
      .select("email, access_token")
      .eq("event_id", eventId)
      .not("email", "is", null);
    for (const v of vols ?? []) {
      const { html, text } = emailLayout({
        heading,
        paragraphs: [intro, "It's on your shifts page, along with your times."],
        button: { label: "View my shifts", url: manageUrl(origin, v) },
      });
      await sendEmail({ to: v.email!, subject: `${heading} · ${event.name}`, html, text });
      await pause();
    }
  }
}
