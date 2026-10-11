import { EVENT_TYPES } from "@/lib/event-types";

/** The event types a pilot request can ask about (the five kinds, plus "something else"). */
export const PILOT_EVENT_TYPES = [
  ...EVENT_TYPES.map((t) => ({ value: t.value as string, label: t.label, icon: t.icon as string })),
  { value: "other", label: "Something else", icon: "✨" },
];

export const pilotEventTypeLabels = (values: readonly string[] | null | undefined) =>
  (values ?? []).map((v) => PILOT_EVENT_TYPES.find((t) => t.value === v)?.label ?? v);
