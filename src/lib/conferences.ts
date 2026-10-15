// Parent-teacher conferences: one day's block cut into meetings. Times are
// "HH:MM" in the event's time zone (see lib/schedule).
import { displayTime, toMinutes, toTime } from "@/lib/schedule";

export const MEETING_LENGTHS = [10, 15, 20, 25, 30, 45, 60] as const;
export const GAP_LENGTHS = [0, 5, 10, 15] as const;

export type MeetingMode = "in_person" | "video" | "either";
export const MEETING_MODES: { value: MeetingMode; label: string; hint: string }[] = [
  { value: "in_person", label: "In person", hint: "Families come to your room." },
  { value: "video", label: "Video", hint: "Families join your Zoom or Google Meet." },
  { value: "either", label: "Parent's choice", hint: "Each family picks in person or video when they book." },
];

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
};

export const SETTINGS_COLUMNS =
  "meeting_minutes, gap_minutes, breaks, times_saved_at, meeting_mode, room, video_link, waiting_room_confirmed, own_link";

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
  return placeMissing(s, venueAddress);
}

export const modeLabel = (m: MeetingMode | null) => MEETING_MODES.find((x) => x.value === m)?.label ?? null;
