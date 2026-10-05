"use client";

import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function BandSettingsForm({
  action,
  chaperoneLimit,
  classifications,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  chaperoneLimit: number;
  classifications: string[];
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" resetOnSuccess={false}>
      <Field label="Chaperone limit per band">
        <NumberInput name="chaperoneLimit" defaultValue={chaperoneLimit} required />
      </Field>
      <Field label="Classifications" hint="Separate with commas, e.g. 1A, 2A, 3A, 4A, 5A, 6A">
        <Input name="classifications" defaultValue={classifications.join(", ")} required />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
