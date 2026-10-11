import { liveEventBanners, type EventAudience } from "@/lib/event-banners";
import { formatTime } from "@/lib/time";
import { EventBanners } from "./event-banners";

/** Live event banners for one audience, at the top of a page. */
export async function EventBannerSlot({
  eventId,
  audience,
  tz,
  className,
}: {
  eventId: string;
  audience: Exclude<EventAudience, "volunteers">;
  tz: string;
  className?: string;
}) {
  const banners = await liveEventBanners(eventId, audience);
  if (banners.length === 0) return null;
  return (
    <div className={className}>
      <EventBanners banners={banners.map((b) => ({ id: b.id, body: b.body, priority: b.priority, time: formatTime(b.created_at, tz) }))} />
    </div>
  );
}
