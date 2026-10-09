// What kind of event. Stored as events.event_type.

export const EVENT_TYPES = [
  {
    value: "band_contest",
    label: "Band contest",
    icon: "🎺",
    blurb: "Band registration, the performance schedule, contest day check-in and your volunteers, all in one place.",
  },
  {
    value: "choir_festival",
    label: "Choir festival",
    icon: "🎶",
    blurb: "Choirs register, then move through your rooms (warm-up, main stage, sight-reading) on a schedule built for you. Families follow each room live.",
  },
  {
    value: "volunteer",
    label: "Volunteer event",
    icon: "🙋",
    blurb: "Shifts, sign-ups, a check-in desk and your team. Run everything else your own way.",
  },
  {
    value: "school_visit",
    label: "School visitor event",
    icon: "🏫",
    blurb: "Parents register ahead (child, teacher and grade), are reminded to bring a photo ID, and are checked in at the door. Student details are deleted 30 days after.",
  },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]["value"];

export const isEventType = (v: unknown): v is EventType => EVENT_TYPES.some((t) => t.value === v);

/** The single performance order, finals and the band check-in path: band contests only. */
export const hasBands = (type: string | null | undefined) => !type || type === "band_contest";

/** Groups that register (the bands table): bands at a band contest, choirs at a choir festival. */
export const hasEnsembles = (type: string | null | undefined) => hasBands(type) || type === "choir_festival";

/** Rooms, and each group's path through them: choir festivals. */
export const hasRooms = (type: string | null | undefined) => type === "choir_festival";

/** What a registered group is called: "band" or "choir". */
export function groupWords(type: string | null | undefined) {
  const one = hasRooms(type) ? "choir" : "band";
  const many = `${one}s`;
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  return { one, many, One: cap(one), Many: cap(many) };
}

/** Parent registration and door check-in: school visitor events. */
export const hasParents = (type: string | null | undefined) => type === "school_visit";

/** "Contest day" for band contests, "Festival day" for choir festivals, "Event day" otherwise. */
export const dayLabel = (type: string | null | undefined) =>
  hasBands(type) ? "Contest day" : hasRooms(type) ? "Festival day" : "Event day";

export const eventTypeLabel = (type: string | null | undefined) =>
  EVENT_TYPES.find((t) => t.value === type)?.label ?? EVENT_TYPES[0].label;
