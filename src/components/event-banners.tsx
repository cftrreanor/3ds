"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LineIcon } from "@/components/line-icon";

export type EventBannerItem = { id: string; body: string; priority: "emergency" | "schedule" | "routine"; time: string; eventName?: string };

/** How long each person sees a banner before it fades away (emergencies stay). */
export const SHOW_FOR_MS = 60_000;

const KEY = "fc-seen-event-banners";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const parse = (raw: string): Record<string, number> => {
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
};

const LOOK = {
  emergency: { box: "border-danger bg-danger/10", label: "Emergency", text: "text-danger" },
  schedule: { box: "border-warning/40 bg-warning-soft", label: "Schedule change", text: "text-foreground" },
  routine: { box: "border-brand/25 bg-brand-soft", label: "Announcement", text: "text-muted" },
} as const;

function BannerCard({ b, fading }: { b: EventBannerItem; fading?: boolean }) {
  const look = LOOK[b.priority];
  return (
    <div
      role={b.priority === "emergency" ? "alert" : "status"}
      className={`rounded-md border-2 px-4 py-3 transition-opacity duration-700 ${look.box} ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <p className={`text-xs font-bold tracking-wide uppercase ${look.text}`}>
        {b.priority === "emergency" && <LineIcon name="warning" inline />}
        {b.priority === "emergency" && <LineIcon name="warning" inline />}
        {look.label} · {b.time}
        {b.eventName ? ` · ${b.eventName}` : ""}
      </p>
      <p className="mt-1 text-base leading-7 font-medium whitespace-pre-line">{b.body}</p>
    </div>
  );
}

/**
 * Day-of event banners. Each person sees a new one for at least a minute
 * (counted from when it first appeared on their screen), then it fades away
 * on its own. Emergencies stay until the host ends them. Faded ones can be
 * shown again with "Recent announcements".
 */
export function EventBanners({ banners }: { banners: EventBannerItem[] }) {
  const seen = parse(useSyncExternalStore(subscribe, read, () => "{}"));
  const [now, setNow] = useState(0);
  const [showOld, setShowOld] = useState(false);

  // Note when each banner first showed on this device; tick so they fade on time.
  useEffect(() => {
    const record = () => {
      const t = Date.now();
      const map = parse(read());
      let changed = false;
      for (const b of banners) {
        if (!map[b.id]) {
          map[b.id] = t;
          changed = true;
        }
      }
      if (changed) {
        try {
          localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(map).slice(-100))));
        } catch {
          // Private browsing: they just won't be remembered.
        }
        listeners.forEach((fn) => fn());
      }
      setNow(t);
    };
    record();
    const id = setInterval(record, 5000);
    return () => clearInterval(id);
  }, [banners]);

  if (banners.length === 0) return null;
  const age = (b: EventBannerItem) => (now && seen[b.id] ? now - seen[b.id] : 0);
  const current = banners.filter((b) => b.priority === "emergency" || age(b) < SHOW_FOR_MS);
  const older = banners.filter((b) => !current.includes(b));

  return (
    <div className="space-y-2">
      {current.map((b) => (
        <BannerCard key={b.id} b={b} fading={b.priority !== "emergency" && age(b) > SHOW_FOR_MS - 2000} />
      ))}
      {older.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowOld((v) => !v)} className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            {showOld ? "Hide" : "Show"} recent announcements ({older.length})
          </button>
          {showOld && (
            <div className="mt-2 space-y-2">
              {older.map((b) => (
                <BannerCard key={b.id} b={b} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
