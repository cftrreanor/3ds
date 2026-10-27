"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input } from "@/components/ui";
import { passwordStrength } from "@/lib/password-strength";
import { setPassword, updateProfile } from "./actions";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  return (
    <ActionForm action={updateProfile} className="space-y-4" resetOnSuccess={false}>
      <Field label="Your name">
        <Input name="fullName" defaultValue={fullName} autoComplete="name" required />
      </Field>
      <Field
        label="Mobile phone"
        hint="10-digit US number. Shared with your event team, and with your sign-up's volunteers on event day."
      >
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={phone} />
      </Field>
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}

const BAR = ["bg-danger", "bg-danger", "bg-warning", "bg-success"];
const TEXT = ["text-danger", "text-danger", "text-warning", "text-success"];

/** Password status, and the form to set or change it (opened on request). */
export function PasswordSection({ hasPassword, email, name }: { hasPassword: boolean; email: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const strength = passwordStrength(pw, { email, name });

  if (!open) {
    return (
      <div className="space-y-4">
        {hasPassword ? (
          <p className="text-sm leading-6">
            <span className="font-semibold text-success">✓ You have a password.</span>{" "}
            <span className="text-muted">Sign in with it or with an email link, whichever is handier.</span>
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted">
            No password yet. It&apos;s optional: with one, you can sign in without waiting for an email. Email links
            keep working too.
          </p>
        )}
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          {hasPassword ? "Change password" : "Set a password"}
        </Button>
      </div>
    );
  }

  return (
    <ActionForm
      action={setPassword}
      className="space-y-4"
      onSuccess={() => {
        setPw("");
        setOpen(false);
      }}
      validate={(data) => {
        const s = passwordStrength(String(data.get("password") ?? ""), { email, name });
        if (s.blocked) return { error: s.tip ?? "Please choose a different password." };
        if (data.get("password") !== data.get("confirm")) return { error: "The two passwords don't match." };
        return null;
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password" className="text-sm font-semibold">
          {hasPassword ? "New password" : "Choose a password"}
        </label>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          autoFocus
          aria-describedby="password-strength password-tip"
          onChange={(e) => setPw(e.target.value)}
        />
        {/* Strength: a 3-part bar plus words, updated as they type. */}
        <div aria-hidden className="mt-1 grid grid-cols-3 gap-1">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-1.5 rounded-full ${pw && strength.level >= n ? BAR[strength.level] : "bg-border"}`} />
          ))}
        </div>
        <p id="password-strength" className="text-sm" aria-live="polite">
          {pw ? (
            <>
              <span className="text-muted">Strength: </span>
              <span className={`font-semibold ${TEXT[strength.level]}`}>{strength.label}</span>
              {strength.tip && <span className="text-muted"> · {strength.tip}</span>}
            </>
          ) : (
            <span className="text-muted">At least 8 characters</span>
          )}
        </p>
        <p id="password-tip" className="text-sm leading-6 text-muted">
          Tip: 3 or 4 random words, like “tuba lantern maple river” (pick your own), are strong and easy to remember.
          Or let your browser suggest one and save it for you.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm-password" className="text-sm font-semibold">
          Type it again
        </label>
        <PasswordInput id="confirm-password" name="confirm" autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton>Save password</SubmitButton>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setPw("");
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
