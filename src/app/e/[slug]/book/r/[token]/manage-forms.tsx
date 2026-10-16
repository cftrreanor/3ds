"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Move the meeting to another open time (and, for parent's choice, in person or video). */
export function ChangeBookingForm({
  action,
  current,
  times,
  mode,
  askMode,
}: {
  action: Action;
  /** The booked time, kept as the first choice. */
  current: { value: string; label: string };
  times: { value: string; label: string }[];
  mode: string;
  askMode: boolean;
}) {
  const [time, setTime] = useState(current.value);
  const [how, setHow] = useState(mode);
  const changed = time !== current.value || how !== mode;
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time">
          <Select name="startsAt" value={time} onChange={(e) => setTime(e.target.value)}>
            <option value={current.value}>{current.label} (your time)</option>
            {times.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        {askMode && (
          <Field label="How you'll meet">
            <Select name="mode" value={how} onChange={(e) => setHow(e.target.value)}>
              <option value="in_person">In person</option>
              <option value="video">Video</option>
            </Select>
          </Field>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton disabled={!changed} aria-describedby={changed ? undefined : "change-hint"}>
          Save the change
        </SubmitButton>
        {!changed && (
          <p id="change-hint" className="text-sm text-muted">
            {askMode ? "Pick a new time or a different way to meet first." : "Pick a new time first."}
          </p>
        )}
      </div>
    </ActionForm>
  );
}

/** Cancel the meeting: red, and the confirmation says what happens. */
export function CancelBookingButton({ action, child }: { action: () => Promise<ActionState>; child: string }) {
  return (
    <ActionForm
      action={async () => action()}
      confirmMessage={`Cancel the conference for ${child}? The time opens up for another family, and everyone on this booking is emailed.`}
    >
      <SubmitButton variant="danger" pendingText="Canceling…">
        Cancel Conference
      </SubmitButton>
    </ActionForm>
  );
}
