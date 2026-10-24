"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { countVisit } from "@/app/site-metrics-actions";
import { isMarketingPath, sourceOf } from "@/lib/site-metrics";

/**
 * Where this visit came from, worked out once per browser tab and kept for the
 * pilot form (sessionStorage stays in this tab; it's never sent anywhere else).
 */
export function visitSource(): string {
  try {
    const saved = sessionStorage.getItem("fc_source");
    if (saved) return saved;
  } catch {
    // Storage blocked: work it out each time.
  }
  const source = sourceOf(document.referrer, window.location.search, window.location.hostname);
  try {
    sessionStorage.setItem("fc_source", source);
  } catch {
    // Storage blocked: fine.
  }
  return source;
}

/**
 * Counts a visit to a marketing page (Admin → Site visits): once per page per
 * tab, so reloading doesn't count twice. No cookies, nothing about the visitor.
 */
export function VisitCounter() {
  const pathname = usePathname();
  useEffect(() => {
    if (!isMarketingPath(pathname) || navigator.webdriver || window.self !== window.top) return;
    const source = visitSource();
    try {
      const key = `fc_visit:${pathname}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: count it anyway.
    }
    countVisit(pathname, source).catch(() => {});
  }, [pathname]);
  return null;
}
