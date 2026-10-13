"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Textarea } from "@/components/ui";
import { ZoneInput } from "@/components/zone-input";
import type { ActionState } from "@/lib/action-state";

export type BoothValues = {
  title: string;
  host_name: string | null;
  zone: string | null;
  location: string | null;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  show_publicly: boolean;
};

/** Add or edit a booth: what it is, who hosts it, where, and a private contact. */
export function BoothForm({
  action,
  initial,
  zones,
  submitLabel = "Add booth",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: BoothValues;
  zones: string[];
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={!initial} className="grid gap-4 sm:grid-cols-2">
      <Field label="What it is" hint="e.g. Dunk Tank, Face Painting, Baked Goods">
        <Input name="title" required maxLength={120} defaultValue={initial?.title} />
      </Field>
      <Field label="Hosted by (optional)" hint="The partner, vendor or group running it, e.g. Verizon">
        <Input name="hostName" maxLength={120} defaultValue={initial?.host_name ?? ""} />
      </Field>
      <Field label="Zone" hint="Groups it on the public page. Use one of these or make up your own.">
        <ZoneInput zones={zones} defaultValue={initial?.zone} />
      </Field>
      <Field label="Where (optional)" hint="e.g. Booth 4, by the gym doors">
        <Input name="location" maxLength={120} defaultValue={initial?.location ?? ""} />
      </Field>
      <Field label="Description (optional)" hint="One line for the public page, e.g. 3D-printed keychains and toys" className="sm:col-span-2">
        <Textarea name="description" maxLength={500} rows={2} defaultValue={initial?.description ?? ""} />
      </Field>
      <fieldset className="grid gap-4 rounded-lg border border-border p-4 sm:col-span-2 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold">Contact (only your team sees this)</legend>
        <Field label="Name">
          <Input name="contactName" maxLength={120} defaultValue={initial?.contact_name ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="contactEmail" type="email" maxLength={254} defaultValue={initial?.contact_email ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="contactPhone" type="tel" inputMode="tel" maxLength={30} defaultValue={initial?.contact_phone ?? ""} />
        </Field>
      </fieldset>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="showPublicly" defaultChecked={initial?.show_publicly ?? true} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
        <span>
          <span className="font-medium">Show on the public page</span>
          <span className="block text-muted">Listed under &ldquo;What&apos;s at the event&rdquo;, with a thank-you to whoever hosts it. Contact details are never shown.</span>
        </span>
      </label>
      <div className="sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Just a booth's zone. Everything else rides along unchanged. */
export function ZoneForm({
  action,
  booth,
  zones,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  booth: BoothValues;
  zones: string[];
}) {
  const keep: [string, string | null][] = [
    ["title", booth.title],
    ["hostName", booth.host_name],
    ["location", booth.location],
    ["description", booth.description],
    ["contactName", booth.contact_name],
    ["contactEmail", booth.contact_email],
    ["contactPhone", booth.contact_phone],
    ["showPublicly", booth.show_publicly ? "on" : null],
  ];
  return (
    <ActionForm action={action} resetOnSuccess={false} className="flex flex-wrap items-start gap-3">
      {keep.map(([name, value]) => value !== null && <input key={name} type="hidden" name={name} value={value} />)}
      <Field label="Zone" className="min-w-0 flex-1 basis-64">
        <ZoneInput zones={zones} defaultValue={booth.zone} />
      </Field>
      <div className="sm:pt-7">
        <SubmitButton>Save zone</SubmitButton>
      </div>
    </ActionForm>
  );
}
