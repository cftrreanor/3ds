"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/time";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type StationValues = {
  name: string;
  station_type: string;
  location: string | null;
  instructions: string | null;
  lead_user_id?: string | null;
};
export type LeadOption = { id: string; label: string };

export function StationForm({
  action,
  initial,
  leads,
  submitLabel = "Add station",
}: {
  action: Action;
  initial?: StationValues;
  leads?: LeadOption[];
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" resetOnSuccess={!initial}>
      <Field label="Station name" hint="e.g. Spectator Parking, Concessions, Warm-Up Area A">
        <Input name="name" required defaultValue={initial?.name} />
      </Field>
      <Field label="Type">
        <Select name="stationType" defaultValue={initial?.station_type ?? "passive"}>
          <option value="passive">Regular station (parking, concessions, hospitality…)</option>
          <option value="active_checkpoint">Band checkpoint (warm-up, inspection, gate)</option>
        </Select>
      </Field>
      <Field label="Location" hint="Optional. Where volunteers should report." className="sm:col-span-2">
        <Input name="location" defaultValue={initial?.location ?? ""} placeholder="e.g. North lot, by the ticket booth" />
      </Field>
      <Field label="Instructions for volunteers" hint="Optional. What to wear, bring and do." className="sm:col-span-2">
        <Textarea name="instructions" defaultValue={initial?.instructions ?? ""} />
      </Field>
      {leads && (
        <Field
          label="Section Lead"
          hint={leads.length ? "Their contact details go to this station's volunteers." : "Invite Section Leads in the Team section above."}
          className="sm:col-span-2"
        >
          <Select name="leadUserId" defaultValue={initial?.lead_user_id ?? ""} disabled={!leads.length}>
            <option value="">No lead yet</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
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

type ShiftValues = { title: string; day: string; startTime: string; endTime: string; capacity: number; description: string | null };

export function ShiftForm({
  action,
  days,
  initial,
  registered = 0,
  submitLabel = "Add shift",
}: {
  action: Action;
  days: string[];
  initial?: ShiftValues;
  registered?: number;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" resetOnSuccess={!initial}>
      <Field label="Title" className="sm:col-span-2">
        <Input name="title" required defaultValue={initial?.title} placeholder="e.g. Morning parking crew" />
      </Field>
      {days.length > 1 ? (
        <Field label="Day" className="sm:col-span-2">
          <Select name="day" defaultValue={initial?.day}>
            {days.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="day" value={initial?.day ?? days[0]} />
      )}
      <Field label="Start time">
        <Input name="startTime" type="time" required defaultValue={initial?.startTime} />
      </Field>
      <Field label="End time">
        <Input name="endTime" type="time" required defaultValue={initial?.endTime} />
      </Field>
      <Field
        label="Volunteers needed"
        hint={registered > 0 ? `${registered} already signed up, so it can't go lower than that.` : undefined}
      >
        <Input name="capacity" type="number" min={Math.max(1, registered)} max={500} defaultValue={initial?.capacity ?? 4} required />
      </Field>
      <Field label="Duties" hint="Optional." className="sm:col-span-2">
        <Textarea name="description" defaultValue={initial?.description ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteButton({
  action,
  label,
  confirmMessage,
  text = "Delete",
}: {
  action: Action;
  label: string;
  confirmMessage: string;
  text?: string;
}) {
  return (
    <ActionForm action={action} confirmMessage={confirmMessage} className="contents">
      <SubmitButton variant="ghost" pendingText="Working…" className="min-h-9 px-2 text-xs" aria-label={label}>
        {text}
      </SubmitButton>
    </ActionForm>
  );
}

export function InviteForm({
  action,
  roles,
  stations,
}: {
  action: Action;
  roles: { value: "volunteer_director" | "section_lead"; label: string }[];
  stations: { id: string; name: string }[];
}) {
  const [role, setRole] = useState(roles[0].value);
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Their email" className="sm:col-span-2">
        <Input name="email" type="email" required autoComplete="off" inputMode="email" />
      </Field>
      {roles.length > 1 ? (
        <Field label="Role">
          <Select name="role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="role" value={roles[0].value} />
      )}
      {role === "section_lead" && stations.length > 0 && (
        <Field label="Station they'll lead" hint="Optional. You can also choose later.">
          <Select name="stationId" defaultValue="">
            <option value="">Decide later</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Creating…">Create invitation</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Copies an invitation link, falling back to selecting it for manual copy. */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      className="min-h-9 px-3 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this invitation link:", url);
        }
      }}
    >
      {copied ? "Copied!" : "Copy invite link"}
    </Button>
  );
}

export function RemoveButton({ action, label, confirmMessage }: { action: Action; label: string; confirmMessage: string }) {
  return (
    <ActionForm action={action} confirmMessage={confirmMessage} className="contents">
      <SubmitButton variant="ghost" pendingText="Removing…" className="min-h-9 px-2 text-xs" aria-label={label}>
        Remove
      </SubmitButton>
    </ActionForm>
  );
}
