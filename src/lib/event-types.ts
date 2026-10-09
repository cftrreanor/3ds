// What kind of event: a band contest (everything) or a volunteer event
// (volunteers and the team only). Stored as events.event_type.

export const EVENT_TYPES = [
  {
    value: "band_contest",
    label: "Band contest",
    icon: "🎺",
    blurb: "Band registration, the performance schedule, contest day check-in and your volunteers, all in one place.",
  },
  {
    value: "volunteer",
    label: "Volunteer event",
    icon: "🙋",
    blurb: "Shifts, sign-ups, a check-in desk and your team. Run everything else your own way.",
  },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]["value"];

export const isEventType = (v: unknown): v is EventType => EVENT_TYPES.some((t) => t.value === v);

/** Bands, schedules and the band check-in path. Anything but a volunteer event. */
export const hasBands = (type: string | null | undefined) => type !== "volunteer";

/** "Contest day" for band contests, "Event day" otherwise. */
export const dayLabel = (type: string | null | undefined) => (hasBands(type) ? "Contest day" : "Event day");

export const eventTypeLabel = (type: string | null | undefined) =>
  EVENT_TYPES.find((t) => t.value === type)?.label ?? EVENT_TYPES[0].label;
