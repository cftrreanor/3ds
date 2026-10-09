"use client";

import { useState } from "react";
import { NumberInput } from "@/components/number-input";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { CHECKPOINT_KINDS, type CheckpointKind } from "@/lib/contest-day";
import { formatDate } from "@/lib/time";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type StationValues = {
  name: string;
  checkpoint_kind: CheckpointKind | null;
  due_minutes_before_warm_up: number | null;
  location: string | null;
  instructions: string | null;
  adults_only?: boolean;
  /** Everyone leading this station, first-added first. */
  lead_ids?: string[];
};
export type LeadOption = { id: string; label: string };

export function StationForm({
  action,
  initial,
  leads,
  submitLabel = "Add station",
  bands = true,
  locations = [],
}: {
  action: Action;
  initial?: StationValues;
  leads?: LeadOption[];
  submitLabel?: string;
  /** A band contest: stations can be stops on the bands' check-in path. */
  bands?: boolean;
  /** Suggestions for Location: a group event's rooms. */
  locations?: string[];
}) {
  const [kind, setKind] = useState<string>(initial?.checkpoint_kind ?? "");
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2" resetOnSuccess={!initial}>
      <Field label="Station name" hint={bands ? "e.g. Spectator Parking, Concessions, Warm-Up Area A" : "e.g. Parking, Concessions, Ticket Table"}>
        <Input name="name" required defaultValue={initial?.name} />
      </Field>
      {bands && (
      <Field
        label="Check-in station?"
        hint="Check-in stations are the stops a band goes through on contest day, in the order you set. Their Section Leads tap bands in."
      >
        <Select name="checkpointKind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">No, a regular station (concessions, hospitality…)</option>
          {CHECKPOINT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}: {k.hint}
            </option>
          ))}
        </Select>
      </Field>
      )}
      {bands && (kind === "parking" || kind === "stop") && (
        <Field
          label="Due how many minutes before the band's warm-up?"
          hint={
            kind === "parking"
              ? "Bands not fully parked by then are flagged Late, so you have time to adjust the schedule."
              : "Optional. Leave blank if this stop has no deadline."
          }
        >
          <NumberInput
            key={kind}
            name="dueMinutes"
            maxLength={3}
            defaultValue={initial?.checkpoint_kind === kind ? (initial.due_minutes_before_warm_up ?? "") : kind === "parking" ? 60 : ""}
          />
        </Field>
      )}
      <Field label="Location" hint="Optional. Where volunteers should report." className="sm:col-span-2">
        <Input
          name="location"
          defaultValue={initial?.location ?? ""}
          placeholder={locations.length ? `e.g. ${locations[0]}` : "e.g. North lot, by the ticket booth"}
          list={locations.length ? "room-locations" : undefined}
        />
        {locations.length > 0 && (
          <datalist id="room-locations">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        )}
      </Field>
      <Field label="Instructions for volunteers" hint="Optional. What to wear, bring and do." className="sm:col-span-2">
        <Textarea name="instructions" defaultValue={initial?.instructions ?? ""} />
      </Field>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="adultsOnly"
          defaultChecked={initial?.adults_only ?? false}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
        />
        <span>
          <span className="font-medium">Adults only (18+)</span>
          <span className="block text-muted">No one under 18 can sign up for this station&apos;s shifts or be added as a walk-up, e.g. Parking.</span>
        </span>
      </label>
      {leads && (
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Section Leads</legend>
          <input type="hidden" name="leadsField" value="1" />
          <p className="mt-1 text-sm text-muted">
            {leads.length
              ? "Pick one or more, so there's a backup if someone can't make it. Every lead sees this station's volunteers; volunteers contact the first lead you added."
              : "Invite Section Leads in the Team card on the event page."}
          </p>
          {leads.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {leads.map((l) => (
                <label key={l.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-brand">
                  <input
                    type="checkbox"
                    name="leadIds"
                    value={l.id}
                    defaultChecked={initial?.lead_ids?.includes(l.id)}
                    className="h-5 w-5 shrink-0 accent-[var(--brand)]"
                  />
                  {l.label}
                </label>
              ))}
            </div>
          )}
        </fieldset>
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
          <NumberInput name="capacity" defaultValue={4} required />
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
        <NumberInput name="capacity" defaultValue={initial?.capacity ?? 4} required />
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
  roles: { value: "volunteer_director" | "section_lead" | "host"; label: string }[];
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
      {role === "host" && (
        <p className="text-sm leading-6 text-muted sm:col-span-2">
          A co-host has the same access you do, on all of your organization&apos;s events: publishing, bands, the
          schedule, volunteers and the team.
        </p>
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
        <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Copies an invitation link, falling back to selecting it for manual copy. */
export function CopyLinkButton({ url, label = "Copy invite link" }: { url: string; label?: string }) {
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
      {copied ? "Copied!" : label}
    </Button>
  );
}

/** A small inline button (Resend, Re-invite) that shows its result next to it. */
export function SmallActionButton({
  action,
  children,
  pendingText = "Sending…",
  label,
}: {
  action: Action;
  children: React.ReactNode;
  pendingText?: string;
  label?: string;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={false} className="contents">
      <SubmitButton variant="secondary" pendingText={pendingText} className="min-h-9 px-3 text-xs" aria-label={label}>
        {children}
      </SubmitButton>
    </ActionForm>
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

/** A single button that runs a server action, showing any error above it. */
export function ActionButton({
  action,
  children,
  variant = "primary",
  confirmMessage,
  pendingText = "Saving…",
}: {
  action: Action;
  children: React.ReactNode;
  /** "go" (green) and "stop" (red outline) for switching something on or off. */
  variant?: "primary" | "secondary" | "go" | "stop";
  confirmMessage?: string;
  pendingText?: string;
}) {
  return (
    <ActionForm action={action} confirmMessage={confirmMessage} className="space-y-2" resetOnSuccess={false}>
      <SubmitButton variant={variant === "stop" ? "danger" : variant} pendingText={pendingText}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}
