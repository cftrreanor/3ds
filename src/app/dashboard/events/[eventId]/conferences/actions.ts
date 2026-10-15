"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { GAP_LENGTHS, MEETING_LENGTHS, type ConferenceBreak, type MeetingMode } from "@/lib/conferences";
import { createClient } from "@/lib/supabase/server";

const TIME = /^\d{2}:\d{2}$/;

function refresh(eventId: string) {
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
}

/** Step 1: meeting length, the gap between meetings and any breaks. */
export async function saveMeetingTimes(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const meeting = Number(formData.get("meetingMinutes"));
  const gap = Number(formData.get("gapMinutes") ?? 0);
  if (!(MEETING_LENGTHS as readonly number[]).includes(meeting)) return { error: "Pick how long each meeting is." };
  if (!(GAP_LENGTHS as readonly number[]).includes(gap)) return { error: "Pick the time between meetings." };

  const starts = formData.getAll("breakStart").map(String);
  const minutes = formData.getAll("breakMinutes").map(String);
  const labels = formData.getAll("breakLabel").map(String);
  const breaks: ConferenceBreak[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (!starts[i] && !minutes[i]) continue;
    const m = Number(minutes[i]);
    if (!TIME.test(starts[i]) || !Number.isInteger(m) || m < 5 || m > 240) {
      return { error: "Give each break a start time and a length of 5 to 240 minutes, or remove it." };
    }
    breaks.push({ start: starts[i], minutes: m, label: labels[i]?.trim().slice(0, 60) || "Break" });
  }
  if (breaks.length > 8) return { error: "Add up to 8 breaks." };

  const supabase = await createClient();
  const { error } = await supabase.from("conference_settings").upsert(
    {
      event_id: eventId,
      meeting_minutes: meeting,
      gap_minutes: gap,
      breaks: breaks.sort((a, b) => a.start.localeCompare(b.start)),
      times_saved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  return { ok: true, message: "Meeting times saved." };
}

/** Step 2: in person (room and directions), video (one link with a waiting room), or the family's choice. */
export async function saveMeetingPlace(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const mode = String(formData.get("mode") ?? "") as MeetingMode;
  if (!["in_person", "video", "either"].includes(mode)) return { error: "Choose where you'll meet." };
  const inPerson = mode !== "video";
  const video = mode !== "in_person";

  const room = String(formData.get("room") ?? "").trim();
  const link = String(formData.get("videoLink") ?? "").trim();
  const waitingRoom = formData.get("waitingRoom") === "on";
  const fieldErrors: Record<string, string> = {};
  if (inPerson && !room) fieldErrors.room = "Add your room and how to find it.";
  if (room.length > 200) fieldErrors.room = "Keep this under 200 characters.";
  if (video) {
    if (!/^https:\/\/\S+$/.test(link) || link.length > 500) fieldErrors.videoLink = "Paste your meeting link. It starts with https://";
    if (!waitingRoom) fieldErrors.waitingRoom = "Set up your meeting with a waiting room, then tick this.";
  }
  if (Object.keys(fieldErrors).length) {
    return { error: Object.values(fieldErrors)[0], fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("conference_settings").upsert(
    {
      event_id: eventId,
      meeting_mode: mode,
      room: inPerson ? room : null,
      video_link: video ? link : null,
      waiting_room_confirmed: video && waitingRoom,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  if (error) return { error: friendlyDbError(error) };
  refresh(eventId);
  return { ok: true, message: "Saved." };
}
