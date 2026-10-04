"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input } from "@/components/ui";
import { setPassword, updateProfile } from "./actions";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  return (
    <ActionForm action={updateProfile} className="space-y-4" resetOnSuccess={false}>
      <Field label="Your name">
        <Input name="fullName" defaultValue={fullName} autoComplete="name" required />
      </Field>
      <Field label="Mobile phone" hint="Shared with your event team, and with your station's volunteers on event day.">
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={phone} />
      </Field>
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={setPassword} className="space-y-4">
      <Field label="New password" hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Type it again">
        <Input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton>Save password</SubmitButton>
    </ActionForm>
  );
}
