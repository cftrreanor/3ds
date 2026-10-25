"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { dollars, PACKAGES, PASSES, RATES } from "@/lib/plan";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** The account's package and rate. The rate changes no features. */
export function PackageForm({ action, pkg, rate }: { action: Action; pkg: string; rate: string }) {
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Package">
          <Select name="package" defaultValue={pkg}>
            {PACKAGES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rate" hint="What they pay at. It changes no features.">
          <Select name="rate" defaultValue={rate}>
            {RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Note (optional)" hint="Why it changed, for the admin activity log.">
        <Input name="note" maxLength={500} placeholder="e.g. Moved to Volunteer Command for spring" />
      </Field>
      <SubmitButton>Save package</SubmitButton>
    </ActionForm>
  );
}

/** A one-time pass: one published event of a type the package doesn't include. */
export function PassForm({ action }: { action: Action }) {
  const [type, setType] = useState<string>(PASSES[0].type);
  const listPrice = PASSES.find((p) => p.type === type)?.cents ?? 0;
  return (
    <ActionForm action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event pass">
          <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {PASSES.map((p) => (
              <option key={p.type} value={p.type}>
                {p.label} ({dollars(p.cents)})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price paid in dollars" hint="0 for a pass given free.">
          <NumberInput key={type} name="price" defaultValue={String(listPrice / 100)} required />
        </Field>
      </div>
      <Field label="Note (optional)" hint="Why, for the admin activity log.">
        <Input name="note" maxLength={500} placeholder="e.g. Paid by check for the spring fair" />
      </Field>
      <SubmitButton variant="secondary" pendingText="Adding…">
        Add event pass
      </SubmitButton>
    </ActionForm>
  );
}

/** Move a free teacher account to a full account on a package they pick. */
export function TeacherUpgradeForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="space-y-3" confirmMessage="Upgrade this teacher to a full account on the package you picked?">
      <Field label="Package">
        <Select name="package" defaultValue="schedule">
          {PACKAGES.filter((p) => p.value !== "free").map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note (optional)" hint="Why, for the admin activity log.">
        <Input name="note" maxLength={500} placeholder="e.g. Joined the school-wide pilot" />
      </Field>
      <SubmitButton variant="secondary" pendingText="Upgrading…">
        Upgrade to full account
      </SubmitButton>
    </ActionForm>
  );
}
