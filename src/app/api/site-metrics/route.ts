import { recordSiteMetric } from "@/lib/site-metrics-server";
import { BROWSER_EVENTS, type SiteEvent } from "@/lib/site-metrics";

// Counts sent from the marketing pages (src/components/site-metrics.tsx), with
// navigator.sendBeacon so a click that leaves the page still counts. Only the
// marketing pages and the kinds of count the browser may report are kept;
// anything else is ignored. Always answers 204, so it tells nobody anything.
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length <= 2000) {
      const body = JSON.parse(raw) as { event?: unknown; path?: unknown; source?: unknown; label?: unknown };
      const event = String(body.event) as SiteEvent;
      if (BROWSER_EVENTS.includes(event)) {
        await recordSiteMetric(event, String(body.path ?? ""), String(body.source ?? ""), String(body.label ?? ""));
      }
    }
  } catch {
    // Not JSON: ignore it.
  }
  return new Response(null, { status: 204 });
}
