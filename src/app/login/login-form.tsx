"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, Input } from "@/components/ui";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm({ linkError, next, email }: { linkError?: boolean; next?: string; email?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(sendLoginLink, {});

  if (state.sentTo) {
    return (
      <div className="space-y-3" role="status">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="leading-7 text-muted">
          We sent a sign-in link to <strong className="text-foreground">{state.sentTo}</strong>. Open it on
          this device to finish signing in. It may take a minute to arrive, so check your spam folder too.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage
        error={
          state.error ??
          (linkError ? "That sign-in link has expired or was already used. Request a new one below." : null)
        }
      />
      <Field label="Email address">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.email ?? email}
          required
          autoFocus
        />
      </Field>
      <SubmitButton className="w-full" pendingText="Sending…">
        Email me a sign-in link
      </SubmitButton>
      <p className="text-sm text-muted">No password needed. New here? This creates your account.</p>
    </form>
  );
}
