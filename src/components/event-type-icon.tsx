import type { EventType } from "@/lib/event-types";

/** Line drawings for each kind of event, in the brand blue (the shared Icons part): the same on every device, unlike emoji. */
const PATHS: Record<EventType, string> = {
  band_contest: "M9 18V5l11-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  group_event: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M18 14.5a5 5 0 0 1 3 4.5",
  volunteer: "M12 20s-7-4.4-9-8.8A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 9 4.2C19 15.6 12 20 12 20z",
  school_visit: "M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5",
  fair: "M3 20 12 4l9 16H3zM12 4v16M9 20l3-5 3 5",
  conference: "M12 7c-1.5-1.2-4-1.4-5.6 0C4.5 8.8 4.6 13 6.5 16.5 8 19.3 10 20.5 12 19.5c2 1 4-.2 5.5-3 1.9-3.5 2-7.7.1-9.5-1.6-1.4-4.1-1.2-5.6 0zM12 7c0-2 1-3.5 3-4",
  meeting: "M5 6h14v13H5zM5 10h14M9 4v4M15 4v4",
};

export function EventTypeIcon({ type, className = "size-5" }: { type: EventType; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[type]} />
    </svg>
  );
}
