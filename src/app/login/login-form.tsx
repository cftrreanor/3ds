"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, Input } from "@/components/ui";
import { sendLoginLink, signInWithPassword, type LoginState } from "./actions";

/** Counts down from `seconds` (restarting whenever `key` changes). */
function useCountdown(seconds: number | undefined, key: unknown) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!seconds) return;
    const until = Date.now() + seconds * 1000;
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [seconds, key]);
  return left;
}

const RESEND_AFTER = 60; // Supabase allows one email per address per minute.

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LoginForm({
  linkError,
  next,
  email,
  sentTo,
}: {
  linkError?: boolean;
  next?: string;
  email?: string;
  /** A link was already emailed here (e.g. leaving demo mode). */
  sentTo?: string;
}) {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [linkState, linkAction] = useActionState<LoginState, FormData>(sendLoginLink, sentTo ? { sentTo } : {});
  const [pwState, pwAction] = useActionState<LoginState, FormData>(signInWithPassword, {});
  const state = mode === "link" ? linkState : pwState;
  const wait = useCountdown(state.sentTo ? RESEND_AFTER : state.retryAfter, state);
  const typedEmail = state.email ?? linkState.sentTo ?? email;

  if (mode === "link" && linkState.sentTo) {
    return (
      <div className="space-y-4" role="status">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="leading-7 text-muted">
          We sent a sign-in link to <strong className="text-foreground">{linkState.sentTo}</strong>. Open it on
          this device to finish signing in. It may take a minute to arrive, so check your spam folder too.
        </p>
        <form action={linkAction}>
          {next && <input type="hidden" name="next" value={next} />}
          <input type="hidden" name="email" value={linkState.sentTo} />
          <SubmitButton variant="secondary" className="w-full" disabled={wait > 0} pendingText="Sending…">
            {wait > 0 ? `Resend link in ${formatSeconds(wait)}` : "Resend link"}
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="How to sign in" className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
        {(["link", "password"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-10 rounded-md text-sm font-medium ${mode === m ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            {m === "link" ? "Email me a link" : "Use my password"}
          </button>
        ))}
      </div>

      <form action={mode === "link" ? linkAction : pwAction} className="space-y-4" key={mode}>
        {next && <input type="hidden" name="next" value={next} />}
        <FormMessage
          error={
            state.error ??
            (linkError && mode === "link"
              ? "That sign-in link has expired or was already used. Request a new one below."
              : null)
          }
        />
        <Field label="Email address">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={typedEmail}
            required
            autoFocus
          />
        </Field>
        {mode === "password" && (
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
        )}
        <SubmitButton
          className="w-full"
          disabled={wait > 0}
          pendingText={mode === "link" ? "Sending…" : "Signing in…"}
        >
          {wait > 0
            ? `Try again in ${formatSeconds(wait)}`
            : mode === "link"
              ? "Email me a sign-in link"
              : "Sign in"}
        </SubmitButton>
        <p className="text-sm text-muted">
          {mode === "link"
            ? "No password needed. First time here? We'll set up your account automatically."
            : "Set a password anytime under Account after signing in with an email link."}
        </p>
      </form>
    </div>
  );
}
