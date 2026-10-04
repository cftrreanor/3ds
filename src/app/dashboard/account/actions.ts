"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyDbError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (!fullName) return { error: "Please enter your name." };
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return { error: "Mobile phone: please enter a 10-digit US number." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/dashboard/account");
  return { ok: true, message: "Saved." };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters.").max(72, "That's too long (72 characters max)."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match." });

export async function setPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return { error: "That password is too easy to guess. Try a longer one." };
    if (error.code === "same_password") return { ok: true, message: "That's already your password." };
    if (error.code === "reauthentication_needed") {
      return { error: "For security, sign out and back in with an email link, then set your password." };
    }
    console.error("updateUser password failed", { code: error.code, message: error.message });
    return { error: "We couldn't save that password. Please try again." };
  }
  return { ok: true, message: "Password saved. Next time, choose “Use my password” on the sign-in page." };
}
