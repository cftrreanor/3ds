"use client";

import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function BandSettingsForm({
  action,
  chaperoneLimit,
  classifications,
  deadline,
  directorInfo,
  contact,
  contactSaved,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  chaperoneLimit: number;
  classifications: string[];
  deadline: string;
  directorInfo: string;
  /** Filled in from the host's own profile until a contact is saved. */
  contact: { name: string; phone: string; email: string };
  contactSaved: boolean;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" resetOnSuccess={false}>
      <Field label="Registration deadline" hint="Optional. Registration closes automatically at the end of this day.">
        <Input type="date" name="deadline" defaultValue={deadline} />
      </Field>
      <Field label="Chaperone limit per band">
        <NumberInput name="chaperoneLimit" defaultValue={chaperoneLimit} required />
      </Field>
      <Field label="Classifications" hint="Separate with commas, e.g. 1A, 2A, 3A, 4A, 5A, 6A" className="sm:col-span-2">
        <Input name="classifications" defaultValue={classifications.join(", ")} required />
      </Field>
      <Field
        label="Information for band directors"
        hint="Optional. Shown on the registration page and each band's contest page: entry fee and how to pay, arrival and unloading, bus parking, awards."
        className="sm:col-span-2"
      >
        <Textarea name="directorInfo" defaultValue={directorInfo} maxLength={3000} rows={6} />
      </Field>
      <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-medium">Contact for band directors</legend>
        <p className="-mt-2 text-sm text-muted sm:col-span-3">
          Only directors registered for this contest (and your team) can see this.
          {!contactSaved && " We've filled in your details; change them if someone else handles bands."}
        </p>
        <Field label="Name">
          <Input name="contactName" defaultValue={contact.name} autoComplete="name" />
        </Field>
        <Field label="Mobile">
          <Input name="contactPhone" type="tel" inputMode="tel" defaultValue={contact.phone} />
        </Field>
        <Field label="Email">
          <Input name="contactEmail" type="email" defaultValue={contact.email} />
        </Field>
      </fieldset>
      <div className="sm:col-span-2">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
