import { loadEventSaves, type EventSave, type SaveArea } from "@/lib/event-saves";
import { formatDate, formatTime, utcToZonedDate, zoneAbbreviation } from "@/lib/time";

/** "Co-host Pat Kim saved this today at 2:14 PM CDT", in the event's time zone. */
export function savedPhrase(save: EventSave, tz: string, now = new Date()) {
  const who = save.isYou ? "You" : [save.role, save.name].filter(Boolean).join(" ") || "Someone on your team";
  const day = utcToZonedDate(save.savedAt, tz);
  const today = utcToZonedDate(now.toISOString(), tz);
  const yesterday = utcToZonedDate(new Date(now.getTime() - 86_400_000).toISOString(), tz);
  const when =
    day === today
      ? "today"
      : day === yesterday
        ? "yesterday"
        : `on ${formatDate(day, day.slice(0, 4) === today.slice(0, 4) ? { year: undefined } : {})}`;
  return `${who} saved this ${when} at ${formatTime(save.savedAt, tz)} ${zoneAbbreviation(save.savedAt, tz)}`;
}

/**
 * Who last saved this part of the event, and when, so a host, co-hosts, and
 * Volunteer Leads can see what someone else already did. Only shown when more
 * than one person manages the event (or someone else made the save).
 */
export async function SavedBy({
  eventId,
  area,
  label,
  className = "",
}: {
  eventId: string;
  area: SaveArea | readonly SaveArea[];
  /** Said first, like "Last change". */
  label?: string;
  className?: string;
}) {
  const { saves, tz } = await loadEventSaves(eventId);
  // Several parts (like "details" and "files" on one page): the latest of them.
  const areas: readonly SaveArea[] = typeof area === "string" ? [area] : area;
  const save = areas
    .map((a) => saves[a])
    .filter((s): s is EventSave => Boolean(s))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
  if (!save || (save.isYou && save.managers < 2)) return null;
  return (
    <p className={`flex items-start gap-1.5 text-xs leading-5 text-muted ${className}`}>
      <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.25" />
        <path d="m5.5 8.2 1.7 1.7 3.3-3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{label ? `${label}: ${savedPhrase(save, tz)}` : savedPhrase(save, tz)}</span>
    </p>
  );
}
