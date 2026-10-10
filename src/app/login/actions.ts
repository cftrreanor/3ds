"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  sentTo?: string;
  error?: string;
  email?: string;
  /** Seconds until another email may be requested, when Supabase tells us. */
  retryAfter?: number;
};

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
    return { ...loginError(error), email: parsed.data };
  }
  const next = safeNext(formData.get("next"));
  if (next) {
    // The callback reads this, since the email link itself can't carry it.
    (await cookies()).set("fc_next", next, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60, path: "/" });
  }
  return { sentTo: parsed.data };
}

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const typed = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(typed);
  const password = String(formData.get("password") ?? "");
  if (!parsed.success) return { error: "Please enter a valid email address.", email: typed };
  if (!password) return { error: "Please enter your password.", email: parsed.data };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data, password });
  if (error) {
    if (error.code === "invalid_credentials" || error.status === 400) {
      return {
        error:
          "That email and password don't match. If you haven't set a password yet, use “Email me a link” instead, then set one under Account.",
        email: parsed.data,
      };
    }
    if (error.status === 429) {
      return { error: "Too many attempts. Please wait a minute and try again.", email: parsed.data, retryAfter: 60 };
    }
    console.error("signInWithPassword failed", { status: error.status, code: error.code, message: error.message });
    return { error: "We couldn't sign you in. Please try again.", email: parsed.data };
  }
  redirect(safeNext(formData.get("next")) ?? "/dashboard");
}

function loginError(error: { status?: number; code?: string; message: string }): Omit<LoginState, "email"> {
  // e.g. "For security purposes, you can only request this after 42 seconds."
  const seconds = Number(error.message.match(/after (\d+) seconds?/)?.[1]);
  if (seconds) {
    return { error: "A sign-in link was just sent. You can request another one shortly.", retryAfter: seconds };
  }
  switch (error.code) {
    case "over_email_send_rate_limit":
      return {
        error:
          "We've hit the limit on sign-in emails for now (our test email service only sends a few per hour). If you've set a password, use “Use my password” instead.",
      };
    case "email_address_not_authorized":
      return {
        error: "This email address can't receive sign-in emails yet. While we're in testing, only approved addresses work.",
      };
    case "email_address_invalid":
      return { error: "That email address doesn't look valid. Please check it and try again." };
    case "signup_disabled":
    case "otp_disabled":
    case "email_provider_disabled":
      return { error: "Email sign-in is turned off in the database settings." };
  }
  if (error.status === 429) {
    return { error: "Too many sign-in emails were requested. Please wait a few minutes and try again.", retryAfter: 60 };
  }
  // Include the reason so problems can be diagnosed from a screenshot.
  return {
    error: `We couldn't send the email. Please try again in a moment. (Details: ${error.code ?? error.status ?? "unknown"}: ${error.message})`,
  };
}
