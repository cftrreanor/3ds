"use server";

import { recordSiteMetric } from "@/lib/site-metrics-server";

// Called from the marketing pages (src/components/visit-counter.tsx and the
// pilot form). Only marketing pages are counted; anything else is ignored.

export async function countVisit(path: string, source: string) {
  await recordSiteMetric("view", String(path), String(source));
}

export async function countPilotOpen(path: string, source: string) {
  await recordSiteMetric("pilot_open", String(path), String(source));
}
