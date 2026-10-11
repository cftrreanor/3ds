"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ } from "@/lib/admin-crm";
import { BANNER_AUDIENCES, BANNER_TONES, HOST_FILTERS } from "@/lib/banner-types";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

const refresh = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
};

/** "2026-10-12T08:00" (admin time zone) → ISO, or null. */
const when = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  return m ? zonedToUtc(m[1], m[2], ADMIN_TZ).toISOString() : null;
};

/** Create a banner, or update one (when the form has an id). */
export async function saveBanner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const linkLabel = String(formData.get("link_label") ?? "").trim();
  const linkUrl = String(formData.get("link_url") ?? "").trim();
  const tone = String(formData.get("tone") ?? "info");
  const audience = String(formData.get("audience") ?? "");
  const hostFilter = audience === "hosts" ? String(formData.get("host_filter") ?? "all") : "all";
  const startsAt = when(formData.get("starts_at")) ?? new Date().toISOString();
  const endsAt = when(formData.get("ends_at"));

  if (!title) return { error: "Give the banner a headline." };
  if (title.length > 120 || body.length > 600) return { error: "Keep the headline under 120 characters and the message under 600." };
  if (!BANNER_TONES.some((t) => t.value === tone)) return { error: "Pick a style." };
  if (!BANNER_AUDIENCES.some((a) => a.value === audience)) return { error: "Pick who should see it." };
  if (!HOST_FILTERS.some((f) => f.value === hostFilter)) return { error: "Pick which hosts." };
  if (linkUrl && !/^https?:\/\/\S+$/i.test(linkUrl)) return { error: "The link must start with https://" };
  if (endsAt && endsAt <= startsAt) return { error: "The end has to be after the start." };

  const row = {
    title,
    body: body || null,
    link_label: linkUrl ? linkLabel || null : null,
    link_url: linkUrl || null,
    tone,
    audience,
    host_filter: hostFilter,
    starts_at: startsAt,
    ends_at: endsAt,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("site_banners").update(row).eq("id", id)
    : await supabase.from("site_banners").insert({ ...row, created_by: user.id });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  const live = Date.parse(startsAt) <= Date.now();
  return { ok: true, message: id ? "Banner saved." : live ? "Banner is live." : "Banner scheduled." };
}

/** Take a banner down now (it stays in the list as ended). */
export async function endBanner(id: string) {
  await requirePlatformAdmin();
  const { error } = await (await createClient()).from("site_banners").update({ ends_at: new Date().toISOString() }).eq("id", id);
  if (error) console.error("endBanner failed", error.message);
  refresh();
}

export async function deleteBanner(id: string) {
  await requirePlatformAdmin();
  const { error } = await (await createClient()).from("site_banners").delete().eq("id", id);
  if (error) console.error("deleteBanner failed", error.message);
  refresh();
}
