"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/time";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function AddStationForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Station name" hint="e.g. Spectator Parking, Concessions, Warm-Up Area A">
        <Input name="name" required />
      </Field>
      <Field label="Type">
        <Select name="stationType" defaultValue="passive">
          <option value="passive">Regular station (parking, concessions, hospitality…)</option>
          <option value="active_checkpoint">Band checkpoint (warm-up, inspection, gate)</option>
        </Select>
      </Field>
      <Field label="Location" hint="Optional. Where volunteers should report." className="sm:col-span-2">
        <Input name="location" placeholder="e.g. North lot, by the ticket booth" />
      </Field>
      <Field label="Instructions for volunteers" hint="Optional. What to wear, bring and do." className="sm:col-span-2">
        <Textarea name="instructions" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Adding…">Add station</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function GenerateShiftsForm({ action, windowLabel }: { action: Action; windowLabel: string }) {
  return (
    <ActionForm action={action} className="space-y-4" resetOnSuccess={false}>
      <p className="text-sm text-muted">
        Split the event day ({windowLabel}) into equal shifts for this station.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Shift length">
          <Select name="blockHours" defaultValue="3">
            {[1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>
                {h} hour{h > 1 ? "s" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Volunteers per shift">
          <Input name="capacity" type="number" min={1} max={500} defaultValue={4} required />
        </Field>
      </div>
      <SubmitButton pendingText="Creating…">Create shifts</SubmitButton>
    </ActionForm>
  );
}

export function AddShiftForm({ action, days }: { action: Action; days: string[] }) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Title" className="sm:col-span-2">
        <Input name="title" required placeholder="e.g. Morning parking crew" />
      </Field>
      {days.length > 1 ? (
        <Field label="Day" className="sm:col-span-2">
          <Select name="day">
            {days.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="day" value={days[0]} />
      )}
      <Field label="Start time">
        <Input name="startTime" type="time" required />
      </Field>
      <Field label="End time">
        <Input name="endTime" type="time" required />
      </Field>
      <Field label="Volunteers needed">
        <Input name="capacity" type="number" min={1} max={500} defaultValue={4} required />
      </Field>
      <Field label="Duties" hint="Optional." className="sm:col-span-2">
        <Textarea name="description" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Adding…">Add shift</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteButton({ action, label, confirmMessage }: { action: Action; label: string; confirmMessage: string }) {
  return (
    <ActionForm action={action} confirmMessage={confirmMessage} className="contents">
      <SubmitButton variant="ghost" pendingText="Deleting…" className="min-h-9 px-2 text-xs" aria-label={label}>
        Delete
      </SubmitButton>
    </ActionForm>
  );
}
