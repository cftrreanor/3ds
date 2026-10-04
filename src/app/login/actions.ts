"use server";

import { cookies, headers } from "next/headers";
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
    // No query string: Supabase matches this against its Redirect URLs list.
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    console.error("signInWithOtp failed", { status: error.status, code: error.code, message: error.message });
    return { error: loginErrorMessage(error), email: parsed.data };
  }
  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) {
    // The callback reads this, since the email link itself can't carry it.
    (await cookies()).set("fc_next", next, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60, path: "/" });
  }
  return { sentTo: parsed.data };
}

function loginErrorMessage(error: { status?: number; code?: string; message: string }) {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "Too many sign-in emails were requested. Please wait a few minutes and try again.";
    case "email_address_not_authorized":
      return "This email address can't receive sign-in emails yet. While we're in testing, only approved addresses work.";
    case "email_address_invalid":
      return "That email address doesn't look valid. Please check it and try again.";
    case "signup_disabled":
    case "otp_disabled":
    case "email_provider_disabled":
      return "Email sign-in is turned off in the database settings.";
  }
  if (error.status === 429) {
    return "Too many sign-in emails were requested. Please wait a few minutes and try again.";
  }
  // Include the reason so problems can be diagnosed from a screenshot.
  return `We couldn't send the email. Please try again in a moment. (Details: ${error.code ?? error.status ?? "unknown"}: ${error.message})`;
}
