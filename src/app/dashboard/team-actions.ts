"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  role: z.enum(["volunteer_director", "section_lead"]),
  stationId: z.string().uuid().or(z.literal("")).optional(),
});

export async function inviteMember(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.email === user.email.toLowerCase()) {
    return { error: "That's your own email. As the host you already have full access." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({
    event_id: eventId,
    email: v.email,
    role: v.role,
    station_id: v.role === "section_lead" && v.stationId ? v.stationId : null,
    invited_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: `${v.email} already has an open invitation. Copy that link below.` };
    return { error: friendlyDbError(error) };
  }

  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: `Invitation created for ${v.email}. Copy the link below and send it to them.` };
}

export async function cancelInvitation(eventId: string, invitationId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

export async function removeMember(eventId: string, userId: string, role: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_staff")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("role", role);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true };
}

export async function acceptInvitation(token: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: eventId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${eventId}`);
}
