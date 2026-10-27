"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { BOT_CHECK_FAILED, passesBotCheck } from "@/lib/bot-check";
import { eventPhase } from "@/lib/contest-day";
import { getOrigin } from "@/lib/data";
import { hasBooths } from "@/lib/event-types";
import { googleCalendarUrl } from "@/lib/ics";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";
import { icsDownloadUrl, loadCalendarEntries, sendSignupConfirmation, toIcsEvent, type ItemLine } from "@/lib/volunteer-emails";
import { addToPass } from "@/lib/volunteer-pass";

export type SignupState = ActionState & {
  confirmed?: {
    email: string;
    emailSent: boolean;
    shifts: { title: string; detail: string; googleUrl: string; icsUrl: string }[];
    alreadySignedUp: number;
    /** The other people they signed up, as stored ("Emma R." for a minor). */
    others: string[];
    /** What they're bringing. */
    items: ItemLine[];
  };
  values?: { fullName: string; email: string; phone: string; shiftIds: string[]; minor: boolean; companions: Companion[] };
};

export type Companion = { name: string; minor: boolean };

const companionsSchema = z
  .array(z.object({ name: z.string().trim().min(1, "Please enter a name for everyone you're adding.").max(200), minor: z.boolean() }))
  .max(4, "You can add up to 4 other people.");

/** "Emma Rodriguez" -> "Emma R.": for minors we only keep the last initial (the database does the same). */
function minorName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(" ")} ${parts.at(-1)![0].toUpperCase()}.`;
}

const schema = z.object({
  fullName: z.string().trim().min(2, "Please enter your first and last name.").max(200),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  phone: z.string().trim().min(1, "Please enter your mobile phone number."),
});

/**
 * Public volunteer signup: shifts, and items to bring. Runs with the server's
 * privileged key because the visitor isn't signed in; sign_up_volunteer() does
 * the capacity checks and locking inside the database, all-or-nothing.
 */
export async function signUpVolunteer(eventId: string, _prev: SignupState, formData: FormData): Promise<SignupState> {
  const shiftIds = formData.getAll("shiftIds").map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const itemPicks = [...new Set(formData.getAll("itemIds").map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].map((id) => ({
    item: id,
    note: String(formData.get(`itemNote-${id}`) ?? "").trim().slice(0, 200),
  }));
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };
  const minor = formData.get("minor") === "on";
  let companions: Companion[] = [];
  try {
    companions = JSON.parse(String(formData.get("companions") ?? "[]"));
  } catch {
    // Handled below as "something went wrong".
  }
  const values = { ...raw, shiftIds, minor, companions: Array.isArray(companions) ? companions : [] };

  // Simple bot traps: a hidden field people never fill in, and a minimum time on the page.
  const startedAt = Number(formData.get("startedAt"));
  if (String(formData.get("website") ?? "") || !startedAt || Date.now() - startedAt < 2500) {
    return { error: "Something went wrong. Please try again.", values };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const others = companionsSchema.safeParse(values.companions);
  if (!others.success) return { error: others.error.issues[0].message, values };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Please enter a 10-digit mobile phone number.", values };
  if (shiftIds.length === 0 && itemPicks.length === 0) return { error: "Pick at least one shift or item above.", values };
  if (itemPicks.length > 12) return { error: "Please pick 12 items or fewer.", values };
  if (shiftIds.length > 12) return { error: "Please pick 12 shifts or fewer.", values };
  if (!(await passesBotCheck(formData))) return { error: BOT_CHECK_FAILED, values };

  const admin = createAdminClient();

  // Fairs close online sign-up on the day itself: helpers who show up go to the volunteer desk.
  const { data: ev } = await admin.from("events").select("event_type, timezone, starts_on, ends_on").eq("id", eventId).maybeSingle();
  if (ev && hasBooths(ev.event_type) && eventPhase(ev, new Date()) === "day") {
    return { error: "Online sign-up is closed on fair day. Find the volunteer desk at the fair to help today.", values };
  }

  // Shifts this email already had: the confirmation screen must not hand this
  // browser control over signups someone else may have made.
  const { data: before } = await admin
    .from("volunteers")
    .select("volunteer_assignments(shift_id), item_signups(item_id)")
    .eq("event_id", eventId)
    .eq("email", parsed.data.email)
    .maybeSingle();
  const alreadyHad = new Set(
    ((before?.volunteer_assignments ?? []) as { shift_id: string }[]).map((a) => a.shift_id),
  );
  const itemsHad = new Set(((before as { item_signups?: { item_id: string }[] } | null)?.item_signups ?? []).map((i) => i.item_id));

  const { data: volunteerId, error } = await admin.rpc("sign_up_volunteer", {
    p_event_id: eventId,
    p_full_name: parsed.data.fullName,
    p_email: parsed.data.email,
    p_phone: phone,
    p_shift_ids: shiftIds,
    p_minor: minor,
    p_companions: others.data,
    p_items: itemPicks,
  });
  if (error) {
    if (["P0001", "P0002", "P0003", "P0005"].includes(error.code ?? "")) return { error: error.message, values };
    console.error("sign_up_volunteer failed", error);
    return { error: "We couldn't save your signup. Please try again.", values };
  }

  const [{ data: event }, { data: assignments }, { data: itemRows }, { data: person }] = await Promise.all([
    admin.from("events").select("slug, name, venue_name, timezone, starts_on, ends_on").eq("id", eventId).single(),
    admin
      .from("volunteer_assignments")
      .select("id, shift_id, manage_token")
      .eq("volunteer_id", volunteerId as string)
      .in("shift_id", shiftIds),
    itemPicks.length
      ? admin
          .from("item_signups")
          .select("item_id, note, manage_token, station_items(name, stations(name))")
          .eq("volunteer_id", volunteerId as string)
          .in("item_id", itemPicks.map((p) => p.item))
      : Promise.resolve({ data: [] }),
    admin.from("volunteers").select("full_name, email, access_token").eq("id", volunteerId as string).single(),
  ]);
  const brought = (itemRows ?? []) as unknown as {
    item_id: string;
    note: string | null;
    manage_token: string;
    station_items: { name: string; stations: { name: string } | null } | null;
  }[];
  const freshItems = brought.filter((b) => !itemsHad.has(b.item_id));
  const itemLines: ItemLine[] = freshItems.map((b) => ({
    name: b.station_items?.name ?? "An item",
    station: b.station_items?.stations?.name ?? "",
    note: b.note,
  }));
  const booked = (assignments ?? []) as { id: string; shift_id: string; manage_token: string }[];
  const fresh = booked.filter((a) => !alreadyHad.has(a.shift_id));

  // Remember this device: it may see and cancel the shifts it just booked.
  await addToPass({ a: [...fresh.map((a) => a.manage_token), ...freshItems.map((b) => b.manage_token)], e: event?.slug ? [event.slug] : [] });

  const origin = await getOrigin();
  const tz = event?.timezone ?? "America/Chicago";
  const multiDay = Boolean(event && event.starts_on !== event.ends_on);
  const entries = await loadCalendarEntries(booked.map((a) => a.id));
  // The email goes to the inbox owner, so it covers every selected shift. Only
  // when something new was booked: sending the same form again (or a script
  // doing it) mustn't fill someone's inbox with copies.
  const emailSent =
    fresh.length + freshItems.length > 0 &&
    (await sendSignupConfirmation(
      fresh.length ? entries : [],
      tz,
      origin,
      multiDay,
      others.data.map((c) => (c.minor ? minorName(c.name) : c.name)),
      itemLines,
      person && event
        ? {
            name: person.full_name,
            email: person.email,
            accessToken: person.access_token,
            eventId,
            eventName: event.name,
            venueName: event.venue_name,
          }
        : undefined,
    ));

  const freshIds = new Set(fresh.map((a) => a.id));
  const rows = entries
    .filter((e) => freshIds.has(e.assignment_id))
    .map((e) => {
      const ics = toIcsEvent(e, origin);
      return {
        title: `${e.station_name}: ${e.shift_title}`,
        detail: [
          multiDay ? formatDate(utcToZonedDate(e.starts_at, tz), { year: undefined }) : null,
          formatTimeRange(e.starts_at, e.ends_at, tz),
          e.station_location,
        ]
          .filter(Boolean)
          .join(" · "),
        googleUrl: googleCalendarUrl(ics),
        icsUrl: icsDownloadUrl(origin, e.manage_token),
      };
    });

  return {
    ok: true,
    confirmed: {
      email: parsed.data.email,
      emailSent,
      shifts: rows,
      alreadySignedUp: booked.length - fresh.length,
      items: itemLines,
      others: others.data.map((c) => (c.minor ? minorName(c.name) : c.name.replace(/\s+/g, " "))),
    },
  };
}
