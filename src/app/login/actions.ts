"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { sentTo?: string; error?: string; email?: string };

const emailSchema = z.string().trim().toLowerCase().email();

export async function sendLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const typed = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(typed);
  if (!parsed.success) return { error: "Please enter a valid email address.", email: typed };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });

  if (error) {
    if (error.status === 429) {
      return {
        error: "Too many sign-in emails were requested. Please wait a few minutes and try again.",
        email: parsed.data,
      };
    }
    console.error("signInWithOtp failed", error);
    return { error: "We couldn't send the email. Please try again in a moment.", email: parsed.data };
  }
  return { sentTo: parsed.data };
}
