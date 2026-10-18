// Parent-teacher conferences: one day's block cut into meetings, or the same
// hours every week (a premium feature). Times are "HH:MM" in the event's time
// zone (see lib/schedule).
import { displayTime, toMinutes, toTime } from "@/lib/schedule";

export const MEETING_LENGTHS = [10, 15, 20, 25, 30, 45, 60] as const;
export const GAP_LENGTHS = [0, 5, 10, 15] as const;

export type MeetingMode = "in_person" | "video" | "either" | "phone";
export const MEETING_MODES: { value: MeetingMode; label: string; hint: string }[] = [
  { value: "in_person", label: "In person", hint: "Families come to your room." },
  { value: "video", label: "Video", hint: "Families join your Zoom or Google Meet." },
  { value: "phone", label: "Phone call", hint: "You call each family at the number they give. Your number isn't shared." },
  { value: "either", label: "Parent's choice", hint: "Each family picks in person or video when they book." },
];

/** A conference day, or the same hours every week (premium). */
export type Schedule = "one_day" | "weekly";

/** One block of weekly hours: day 0 is Sunday, as JavaScript's getDay() and Postgres's dow count them. */
export type WeeklyRange = { day: number; start: string; end: string };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** How much notice families give before a weekly meeting, in hours. */
export const NOTICE_HOURS = [0, 2, 12, 24, 48, 72, 168] as const;
/** How far ahead families can book weekly meetings, in days. */
export const AHEAD_DAYS = [7, 14, 21, 28, 60, 90] as const;

export function noticeLabel(h: number) {
  if (h === 0) return "No notice needed";
  if (h === 168) return "1 week";
  if (h % 24 === 0) return `${h / 24} ${h === 24 ? "day" : "days"}`;
  return `${h} hours`;
}

export function aheadLabel(d: number) {
  return d % 7 === 0 && d <= 28 ? `${d / 7} ${d === 7 ? "week" : "weeks"}` : `${d} days`;
}

export type ConferenceBreak = { start: string; minutes: number; label: string };

export type ConferenceSettings = {
  meeting_minutes: number;
  gap_minutes: number;
  breaks: ConferenceBreak[];
  times_saved_at: string | null;
  meeting_mode: MeetingMode | null;
  room: string | null;
  video_link: string | null;
  waiting_room_confirmed: boolean;
  /** The teacher sends families the video link themselves (in their own calendar invite). */
  own_link: boolean;
  schedule: Schedule;
  weekly_hours: WeeklyRange[];
  /** Days off from weekly hours, "YYYY-MM-DD". */
  closed_dates: string[];
  min_notice_hours: number;
  max_days_ahead: number;
};

export const DEFAULT_SETTINGS: ConferenceSettings = {
  meeting_minutes: 15,
  gap_minutes: 0,
  breaks: [],
  times_saved_at: null,
  meeting_mode: null,
  room: null,
  video_link: null,
  waiting_room_confirmed: false,
  own_link: false,
  schedule: "one_day",
  weekly_hours: [],
  closed_dates: [],
  min_notice_hours: 24,
  max_days_ahead: 14,
};

/** Before the weekly hours update (20261211000000) has been run. */
export const LEGACY_SETTINGS_COLUMNS =
  "meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room, video_link, waiting_room_confirmed, own_link";
export const SETTINGS_COLUMNS = `${LEGACY_SETTINGS_COLUMNS}, schedule, weekly_hours, closed_dates, min_notice_hours, max_days_ahead`;

/**
 * Each meeting's start between `start` and `end`: back to back (plus the
 * gap), skipping any that would run into a break.
 */
export function meetingStarts(
  start: string,
  end: string,
  s: Pick<ConferenceSettings, "meeting_minutes" | "gap_minutes" | "breaks">,
): string[] {
  const len = s.meeting_minutes;
  const finish = toMinutes(end);
  const breaks = s.breaks
    .filter((b) => b.start && b.minutes > 0)
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.start) + b.minutes }))
    .sort((a, b) => a.start - b.start);
  const out: string[] = [];
  let t = toMinutes(start);
  while (t + len <= finish && out.length < 200) {
    const clash = breaks.find((b) => t < b.end && t + len > b.start);
    if (clash) {
      t = clash.end;
      continue;
    }
    out.push(toTime(t));
    t += len + s.gap_minutes;
  }
  return out;
}

/** Weekly hours sorted by day, then time. */
export const sortWeekly = (hours: WeeklyRange[]) => [...hours].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

/** Meetings in each week's hours. */
export function weeklyMeetingCount(hours: WeeklyRange[], s: Pick<ConferenceSettings, "meeting_minutes" | "gap_minutes" | "breaks">) {
  return hours.reduce((n, h) => n + meetingStarts(h.start, h.end, s).length, 0);
}

/** "Tuesdays 3:30 – 4:30 PM · Thursdays 3:30 – 4:30 PM" */
export function weeklySummary(hours: WeeklyRange[]) {
  if (!hours.length) return "No weekly hours yet";
  return sortWeekly(hours)
    .map((h) => `${WEEKDAYS[h.day]}s ${displayTime(h.start)} – ${displayTime(h.end)}`)
    .join(" · ");
}

/** "18 meetings · 3:00 PM – 7:15 PM" */
export function meetingSummary(starts: string[], meetingMinutes: number) {
  if (!starts.length) return "No meetings fit in your hours yet";
  const last = toTime(toMinutes(starts[starts.length - 1]) + meetingMinutes);
  return `${starts.length} ${starts.length === 1 ? "meeting" : "meetings"} · ${displayTime(starts[0])} – ${displayTime(last)}`;
}

/**
 * What step 2 (where you'll meet) still needs (null when done). In person
 * needs the school's address (kept on the event) and a room; video needs a
 * link pasted here with the waiting room ticked, unless the teacher sends
 * their own.
 */
export function placeMissing(s: ConferenceSettings | null, venueAddress: string | null): string | null {
  if (!s?.meeting_mode) return "Choose where you'll meet (step 2).";
  if (s.meeting_mode === "phone") return null;
  if (s.meeting_mode !== "video" && !venueAddress?.trim()) return "Add your school's address (step 2).";
  if (s.meeting_mode !== "video" && !s.room?.trim()) return "Add your room and directions (step 2).";
  if (s.meeting_mode !== "in_person" && !s.own_link && !s.video_link) return "Add your meeting link (step 2).";
  if (s.meeting_mode !== "in_person" && !s.own_link && !s.waiting_room_confirmed)
    return "Tick that your meeting has a waiting room and runs the whole time (step 2).";
  return null;
}

/** What's still needed before publishing, matching the database's check (null when ready). */
export function notReady(s: ConferenceSettings | null, venueAddress: string | null): string | null {
  if (!s?.times_saved_at) return "Save your meeting times (step 1).";
  if (s.schedule === "weekly" && !s.weekly_hours.length) return "Add your weekly hours (step 1).";
  return placeMissing(s, venueAddress);
}

export const modeLabel = (m: MeetingMode | null) => MEETING_MODES.find((x) => x.value === m)?.label ?? null;
