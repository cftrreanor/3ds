"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";

export type SignupState = ActionState & {
  confirmed?: { email: string; emailSent: boolean; shifts: { title: string; detail: string }[] };
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
  const { error } = await admin.rpc("register_volunteer", {
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

  // Details for the confirmation screen and email.
  const [{ data: event }, { data: shifts }] = await Promise.all([
    admin.from("events").select("name, timezone, venue_name, venue_address, starts_on, ends_on").eq("id", eventId).single(),
    admin
      .from("shifts")
      .select("title, starts_at, ends_at, stations(name, location)")
      .in("id", shiftIds)
      .order("starts_at"),
  ]);
  const multiDay = event && event.starts_on !== event.ends_on;
  const rows = ((shifts ?? []) as unknown as {
    title: string;
    starts_at: string;
    ends_at: string;
    stations: { name: string; location: string | null } | null;
  }[]).map((s) => ({
    title: `${s.stations?.name ?? "Station"}: ${s.title}`,
    detail: [
      multiDay ? formatDate(utcToZonedDate(s.starts_at, event!.timezone), { year: undefined }) : null,
      formatTimeRange(s.starts_at, s.ends_at, event!.timezone),
      s.stations?.location,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  const origin = await getOrigin();
  const { html, text } = emailLayout({
    heading: `You're signed up for ${event?.name ?? "the event"}`,
    paragraphs: [
      `Thanks, ${parsed.data.fullName.split(" ")[0]}! Here are your shifts${event?.venue_name ? ` at ${event.venue_name}` : ""}.`,
      "Your agenda page has every shift, where to report, and your section lead's contact details. You'll confirm your email when you open it.",
    ],
    rows,
    button: { label: "View my shifts", url: `${origin}/my` },
    footer: `You're receiving this because you signed up to volunteer through ${brand.name}. Need to cancel? Open your shifts page.`,
  });
  const emailSent = await sendEmail({
    to: parsed.data.email,
    subject: `You're signed up: ${event?.name ?? "volunteer shifts"}`,
    html,
    text,
  });

  return { ok: true, confirmed: { email: parsed.data.email, emailSent, shifts: rows } };
}
