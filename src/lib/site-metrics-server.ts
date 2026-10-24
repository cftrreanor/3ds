import "server-only";
import { ADMIN_TZ } from "@/lib/admin-crm";
import { getUser } from "@/lib/auth";
import { isQa } from "@/lib/qa";
import { isSchemaError } from "@/lib/schema-check";
import { cleanSource, isMarketingPath, type SiteEvent } from "@/lib/site-metrics";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Adds one to today's count for a marketing page (Admin → Site visits). People
 * already signed in (organizers, and us) aren't counted, except on the QA site
 * where reviewers are always signed in. Never throws: counting never gets in
 * the way of the page or the pilot form.
 */
export async function recordSiteMetric(event: SiteEvent, path: string, source: string) {
  if (!isMarketingPath(path)) return;
  try {
    if (!isQa() && (await getUser())) return;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: ADMIN_TZ }).format(new Date());
    const { error } = await createAdminClient().rpc("bump_site_metric", {
      p_day: day,
      p_path: path,
      p_source: cleanSource(source),
      p_event: event,
    });
    // Before the database update (20261217000000_site_metrics.sql) there's nowhere to count yet.
    if (error && !isSchemaError(error)) console.error("Counting a site visit failed", error);
  } catch (err) {
    console.error("Counting a site visit failed", err);
  }
}
