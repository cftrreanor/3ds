import type { EventType } from "@/lib/event-types";
import type { IconName } from "@/lib/icons";
import { LineIcon } from "./line-icon";

/** Each kind of event's line icon (the shared Icons part). */
export const EVENT_TYPE_ICON: Record<EventType, IconName> = {
  band_contest: "band",
  group_event: "group",
  volunteer: "volunteer",
  school_visit: "school",
  fair: "fair",
  conference: "apple",
  meeting: "calendar",
};

export function EventTypeIcon({ type, className = "size-5" }: { type: EventType; className?: string }) {
  return <LineIcon name={EVENT_TYPE_ICON[type]} className={className} />;
}
