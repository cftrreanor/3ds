"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, FormMessage, Input } from "@/components/ui";
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
  // Kept in state so it carries over when switching between link and password.
  const [typed, setTyped] = useState(email ?? "");
  const submitRef = useRef<HTMLButtonElement>(null);

  if (mode === "link" && linkState.sentTo) {
    return (
      <div className="space-y-4" role="status">
        <h2 className="text-xl font-semibold">Check your email</h2>
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

  /** Back to the email link, with the address kept and the send button ready to tap. */
  const backToLink = () => {
    setMode("link");
    requestAnimationFrame(() => submitRef.current?.focus());
  };

  return (
    <div className="space-y-5">
      {/* One main path (email link); a password is the secondary choice, not an equal tab. */}
      <form action={mode === "link" ? linkAction : pwAction} className="space-y-4">
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
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            required
            autoFocus
          />
        </Field>
        {mode === "password" && (
          // Not <Field>: its <label> would wrap the Show button and add "Show" to the box's name.
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-sm font-semibold">
              Password
            </label>
            <PasswordInput id="login-password" name="password" autoComplete="current-password" required autoFocus={!!typed} />
          </div>
        )}
        <SubmitButton
          ref={submitRef}
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
        {mode === "link" && (
          <p className="text-sm text-muted">No password needed. First time here? We&apos;ll set up your account automatically.</p>
        )}
      </form>

      {mode === "link" ? (
        <>
          <div className="flex items-center gap-3 text-sm text-muted" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setMode("password")}>
            Sign in with a password instead
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">
          Forgot your password, or never set one?{" "}
          <button type="button" onClick={backToLink} className="font-semibold text-brand underline underline-offset-4">
            Sign in with an email link instead
          </button>
        </p>
      )}
    </div>
  );
}
