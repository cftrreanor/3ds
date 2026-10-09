"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Field, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/** Running behind: move a group and everyone after them later, and email their directors. */
export function RoomPushBackForm({
  action,
  groups,
  defaultGroup,
  posted,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Every group on the saved schedule, in order. */
  groups: { id: string; label: string }[];
  /** The first group that hasn't started yet. */
  defaultGroup: string;
  /** Directors only get emails once the schedule is posted. */
  posted: boolean;
}) {
  const [minutes, setMinutes] = useState("10");
  const [from, setFrom] = useState(defaultGroup);
  const first = groups.find((g) => g.id === from);
  return (
    <ActionForm
      action={action}
      resetOnSuccess={false}
      confirmMessage={`Move ${first?.label.split(" · ")[0].replace(/^\d+\. /, "") ?? "that group"} and every group after them ${minutes || "?"} minutes later?`}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starting with">
          <Select name="bandId" value={from} onChange={(e) => setFrom(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How many minutes later?">
          <NumberInput name="minutes" maxLength={3} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
      </div>
      {posted && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="email" defaultChecked className="h-5 w-5 accent-[var(--brand)]" />
          Email those groups&apos; directors their new times
        </label>
      )}
      <SubmitButton variant="warn" pendingText="Moving…">
        Push the schedule back
      </SubmitButton>
    </ActionForm>
  );
}
