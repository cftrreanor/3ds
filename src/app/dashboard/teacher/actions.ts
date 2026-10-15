"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { notifyAdmins } from "@/lib/admin-alerts";
import { requireUser } from "@/lib/auth";
import { getOrigin } from "@/lib/data";
import { emailLayout } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { isValidTimezone, zoneName } from "@/lib/time";

/**
 * A teacher sets up their free account (no invitation needed), then goes
 * straight to making their first conference. We get an email about it.
 */
export async function createTeacherAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  const tz = String(formData.get("timezone") ?? "");
  if (fullName.length < 2) return { error: "Please enter your name." };
  if (school.length < 2) return { error: "Please enter your school's name." };
  if (!isValidTimezone(tz)) return { error: "Please pick your time zone." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_teacher_account", { p_full_name: fullName, p_school: school, p_tz: tz });
  if (error?.code === "P0001") return { error: error.message };
  if (error) return { error: friendlyDbError(error) };

  const origin = await getOrigin();
  after(async () => {
    const { html, text } = emailLayout({
      heading: `New teacher account: ${fullName}`,
      paragraphs: [`${fullName} signed up for a free teacher account. Reply to this email to reach them.`],
      rows: [
        { title: "Name", detail: fullName },
        { title: "Email", detail: user.email },
        { title: "School", detail: school },
        { title: "Time zone", detail: zoneName(tz) },
      ],
      button: { label: "Open accounts", url: `${origin}/admin/accounts` },
    });
    await notifyAdmins({ subject: `New teacher account: ${fullName}, ${school}`, html, text, replyTo: user.email });
  });

  redirect("/dashboard/events/new?type=conference");
}
