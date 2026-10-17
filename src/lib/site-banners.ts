import "server-only";
import { freeStatus } from "@/lib/admin";
import { BANNER_COLUMNS, type BannerAudience, type HostFilter, type SiteBanner } from "@/lib/banner-types";
import { isSchemaError } from "@/lib/schema-check";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type HostOrg = { subscription_status: string; free_until: string | null; default_timezone: string; account_kind?: string };

/** Does a host's organization match a banner's host filter? */
export function hostMatches(filter: HostFilter, org: HostOrg) {
  switch (filter) {
    case "all":
      return true;
    case "pilot":
      return org.subscription_status === "comped";
    case "trial":
      return org.subscription_status === "trialing";
    case "paid":
      return org.subscription_status === "active" || org.subscription_status === "past_due";
    case "free_ending": {
      const f = freeStatus(org);
      return Boolean(f && (f.ended || f.soon));
    }
    case "teacher":
      return org.account_kind === "teacher";
    case "schools":
      return org.account_kind !== "teacher";
  }
}

/** Which groups a signed-in person belongs to, and their organizations (for host filters). */
async function rolesOf(userId: string) {
  const admin = createAdminClient();
  const [{ data: orgs }, { count: bands }, { count: staff }] = await Promise.all([
    admin.from("organization_members").select("organizations(subscription_status, free_until, default_timezone, account_kind)").eq("user_id", userId),
    admin.from("bands").select("id", { count: "exact", head: true }).eq("director_user_id", userId),
    admin.from("event_staff").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return {
    hostOrgs: ((orgs ?? []) as unknown as { organizations: HostOrg | null }[]).map((o) => o.organizations).filter((o): o is HostOrg => Boolean(o)),
    director: Boolean(bands),
    team: Boolean(staff),
  };
}

/**
 * The live company banners for a signed-in person: those aimed at a group
 * they're in (hosts filtered by their plan), minus ones they've closed.
 */
export async function bannersForUser(userId: string): Promise<SiteBanner[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: closed }, roles] = await Promise.all([
    supabase.from("site_banners").select(BANNER_COLUMNS).neq("audience", "public").order("starts_at", { ascending: false }),
    supabase.from("site_banner_dismissals").select("banner_id").eq("user_id", userId),
    rolesOf(userId),
  ]);
  if (error) {
    // Before the banners database update has been run: no banners.
    if (!isSchemaError(error)) console.error("site banners load failed", error.message);
    return [];
  }
  const closedIds = new Set(((closed ?? []) as { banner_id: string }[]).map((c) => c.banner_id));
  const now = Date.now();
  const forMe = (b: SiteBanner) => {
    if (Date.parse(b.starts_at) > now || (b.ends_at && Date.parse(b.ends_at) <= now)) return false;
    const audience: Record<Exclude<BannerAudience, "public">, boolean> = {
      hosts: roles.hostOrgs.some((o) => hostMatches(b.host_filter, o)),
      directors: roles.director,
      teams: roles.team,
    };
    return audience[b.audience as Exclude<BannerAudience, "public">] ?? false;
  };
  return ((data ?? []) as SiteBanner[]).filter((b) => forMe(b) && (b.tone === "urgent" || !closedIds.has(b.id)));
}

/** Live banners for public visitors (the home page). */
export async function publicBanners(): Promise<SiteBanner[]> {
  const { data, error } = await createAdminClient()
    .from("site_banners")
    .select(BANNER_COLUMNS)
    .eq("audience", "public")
    .lte("starts_at", new Date().toISOString())
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("starts_at", { ascending: false });
  if (error && !isSchemaError(error)) console.error("public banners load failed", error.message);
  return (data ?? []) as SiteBanner[];
}
