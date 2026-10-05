"use client";

import { useEffect, useState } from "react";

/**
 * "The schedule has been updated - Refresh now". Checks every minute, and as
 * soon as the page is looked at again (phone unlocked, tab switched back), for
 * a newer schedule than the one on screen.
 */
export function ScheduleUpdateBanner({ slug, version }: { slug: string; version: string | null }) {
  const [latest, setLatest] = useState(version);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/schedule-version?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const { v } = (await res.json()) as { v: string | null };
        if (!stopped) setLatest(v);
      } catch {
        // Offline for a moment; try again next time.
      }
    };
    const id = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [slug]);

  // Only something newer than what's on screen counts (the page may also have
  // refreshed itself since the last check).
  const changed = Boolean(latest && (!version || new Date(latest).getTime() > new Date(version).getTime()));
  if (!changed) return null;
  return (
    <div role="status" className="sticky top-0 z-20 border-b border-accent bg-accent-soft">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <p className="flex-1 text-sm font-medium">The schedule has been updated.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-10 shrink-0 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:opacity-90"
        >
          Refresh now
        </button>
      </div>
    </div>
  );
}
