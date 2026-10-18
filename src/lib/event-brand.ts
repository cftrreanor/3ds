import "server-only";
import { cache } from "react";
import { LOGO_BUCKET, LOGO_TYPES } from "@/lib/badges";
import { isHexColor } from "@/lib/brand-color";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * The look an event's public pages take from its account: the logo (served by
 * /e/[slug]/logo) and the color. Logos and colors are public by nature, so our
 * server reads them for anyone. Works before the color's database update too.
 */
export const loadEventBrand = cache(async (slug: string): Promise<{ logoPath: string | null; color: string | null }> => {
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("organization_id").eq("slug", slug).maybeSingle();
  if (!event?.organization_id) return { logoPath: null, color: null };
  const withColor = await admin.from("organizations").select("logo_path, brand_color").eq("id", event.organization_id).maybeSingle();
  const org = (
    withColor.error
      ? (await admin.from("organizations").select("logo_path").eq("id", event.organization_id).maybeSingle()).data
      : withColor.data
  ) as { logo_path: string | null; brand_color?: string | null } | null;
  return { logoPath: org?.logo_path ?? null, color: isHexColor(org?.brand_color) ? org.brand_color : null };
});

/** The logo's address for an <img>; it changes when a new logo is uploaded, so browsers don't show the old one. */
export function eventLogoUrl(slug: string, logoPath: string | null) {
  if (!logoPath) return null;
  const version = logoPath.split("/").pop()?.split(".")[0] ?? "";
  return `/e/${slug}/logo?v=${version}`;
}

/** The logo file itself, or null. */
export async function downloadEventLogo(slug: string) {
  const { logoPath } = await loadEventBrand(slug);
  if (!logoPath) return null;
  const { data: file } = await createAdminClient().storage.from(LOGO_BUCKET).download(logoPath);
  if (!file) return null;
  const type = file.type && (LOGO_TYPES as readonly string[]).includes(file.type) ? file.type : "image/png";
  return { body: await file.arrayBuffer(), type };
}
