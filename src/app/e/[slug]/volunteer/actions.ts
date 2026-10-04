"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getOrigin } from "@/lib/data";
import { googleCalendarUrl } from "@/lib/ics";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";
import { icsDownloadUrl, loadCalendarEntries, sendSignupConfirmation, toIcsEvent } from "@/lib/volunteer-emails";
import { addToPass } from "@/lib/volunteer-pass";

export type SignupState = ActionState & {
  confirmed?: {
    email: string;
    emailSent: boolean;
    shifts: { title: string; detail: string; googleUrl: string; icsUrl: string }[];
    alreadySignedUp: number;
  };
  values?: { fullName: string; email: string; phone: string; shiftIds: string[] };
};

const schema = z.object({
  fullName: z.string().trim().min(2, "Please enter your first and last name.").max(200),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  phone: z.string().trim().min(1, "Please enter your mobile phone number."),
});

/**
 * Public volunteer signup. Runs with the server's privileged key because the
 * visitor isn't signed in; register_volunteer() does the capacity checks and
 * locking inside the database, all-or-nothing.
 */
export async function signUpVolunteer(eventId: string, _prev: SignupState, formData: FormData): Promise<SignupState> {
  const shiftIds = formData.getAll("shiftIds").map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };
  const values = { ...raw, shiftIds };

  // Simple bot traps: a hidden field people never fill in, and a minimum time on the page.
  const startedAt = Number(formData.get("startedAt"));
  if (String(formData.get("website") ?? "") || !startedAt || Date.now() - startedAt < 2500) {
    return { error: "Something went wrong. Please try again.", values };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Please enter a 10-digit mobile phone number.", values };
  if (shiftIds.length === 0) return { error: "Pick at least one shift above.", values };
  if (shiftIds.length > 12) return { error: "That's a lot of shifts! Please pick 12 or fewer.", values };

  const admin = createAdminClient();

  // Shifts this email already had: the confirmation screen must not hand this
  // browser control over signups someone else may have made.
  const { data: before } = await admin
    .from("volunteers")
    .select("volunteer_assignments(shift_id)")
    .eq("event_id", eventId)
    .eq("email", parsed.data.email)
    .maybeSingle();
  const alreadyHad = new Set(
    ((before?.volunteer_assignments ?? []) as { shift_id: string }[]).map((a) => a.shift_id),
  );

  const { data: volunteerId, error } = await admin.rpc("register_volunteer", {
    p_event_id: eventId,
    p_full_name: parsed.data.fullName,
    p_email: parsed.data.email,
    p_phone: phone,
    p_shift_ids: shiftIds,
  });
  if (error) {
    if (["P0001", "P0002", "P0003"].includes(error.code ?? "")) return { error: error.message, values };
    console.error("register_volunteer failed", error);
    return { error: "We couldn't save your signup. Please try again.", values };
  }

  const [{ data: event }, { data: assignments }] = await Promise.all([
    admin.from("events").select("timezone, starts_on, ends_on").eq("id", eventId).single(),
    admin
      .from("volunteer_assignments")
      .select("id, shift_id, manage_token")
      .eq("volunteer_id", volunteerId as string)
      .in("shift_id", shiftIds),
  ]);
  const booked = (assignments ?? []) as { id: string; shift_id: string; manage_token: string }[];
  const fresh = booked.filter((a) => !alreadyHad.has(a.shift_id));

  // Remember this device: it may see and cancel the shifts it just booked.
  await addToPass({ a: fresh.map((a) => a.manage_token) });

  const origin = await getOrigin();
  const tz = event?.timezone ?? "America/Chicago";
  const multiDay = Boolean(event && event.starts_on !== event.ends_on);
  const entries = await loadCalendarEntries(booked.map((a) => a.id));
  // The email goes to the inbox owner, so it covers every selected shift.
  const emailSent = await sendSignupConfirmation(entries, tz, origin, multiDay);

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
    },
  };
}
