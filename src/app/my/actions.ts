"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { getUser } from "@/lib/auth";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/time";
import { loadCalendarEntries, sendCancellation } from "@/lib/volunteer-emails";
import { forgetPass, hasPass, readPass } from "@/lib/volunteer-pass";

/**
 * Cancel one of my shifts: allowed with this device's pass (no login), or for
 * a signed-in volunteer whose email matches. Sends a calendar cancellation.
 */
export async function cancelMyShift(assignmentId: string): Promise<ActionState> {
  const [entry] = await loadCalendarEntries([assignmentId]);
  const pass = await readPass();
  let cancelled = false;

  if (hasPass(pass)) {
    const { data, error } = await createAdminClient().rpc("cancel_with_pass", {
      p_assignment_id: assignmentId,
      p_volunteer_tokens: pass.v,
      p_assignment_tokens: pass.a,
    });
    if (error) return { error: friendlyDbError(error) };
    cancelled = data === true;
  }
  if (!cancelled && (await getUser())) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_assignment", { p_assignment_id: assignmentId });
    if (error) return { error: friendlyDbError(error) };
    cancelled = true;
  }
  if (!cancelled) return { error: "This device doesn't have access to that shift anymore. Use the link in your email." };

  if (entry) {
    const origin = await getOrigin();
    after(() => sendCancellation(entry, entry.timezone, origin));
  }
  revalidatePath("/my");
  return { ok: true };
}

export async function forgetThisDevice(): Promise<ActionState> {
  await forgetPass();
  revalidatePath("/my");
  return { ok: true };
}

/**
 * "Email me my link": sends the private View-my-shifts link(s) for an email
 * address. Always gives the same answer, so it can't be used to discover who
 * volunteered, and won't resend more than once every 10 minutes per signup.
 */
export async function emailMyLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Please enter a valid email address." };
  const generic: ActionState = {
    ok: true,
    message: `If ${parsed.data} has upcoming shifts, we just emailed a link to view them. It can take a minute to arrive.`,
  };

  const admin = createAdminClient();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await admin
    .from("volunteers")
    .select("id, full_name, access_token, link_sent_at, events!inner(name, starts_on, ends_on)")
    .eq("email", parsed.data)
    .gte("events.ends_on", weekAgo)
    .or(`link_sent_at.is.null,link_sent_at.lt.${tenMinutesAgo}`);
  const records = (data ?? []) as unknown as {
    id: string;
    full_name: string;
    access_token: string;
    events: { name: string; starts_on: string; ends_on: string };
  }[];
  if (records.length === 0) return generic;

  await admin
    .from("volunteers")
    .update({ link_sent_at: new Date().toISOString() })
    .in(
      "id",
      records.map((r) => r.id),
    );

  const origin = await getOrigin();
  const { html, text } = emailLayout({
    heading: "Your volunteer shifts",
    paragraphs: [
      `Hi ${records[0].full_name.split(" ")[0]}, here's your link to view or cancel your shifts. It's just for you.`,
    ],
    rows: records.map((r) => ({
      title: r.events.name,
      detail: formatDateRange(r.events.starts_on, r.events.ends_on),
      links: [{ label: "View my shifts", url: `${origin}/pass/${r.access_token}` }],
    })),
    footer: "Didn't ask for this? You can ignore this email.",
  });
  await sendEmail({ to: parsed.data, subject: "Your volunteer shifts", html, text });
  return generic;
}
