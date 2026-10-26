"use client";

import { useCallback, useState } from "react";
import { NumberInput } from "@/components/number-input";
import { ZoneInput } from "@/components/zone-input";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { CHECKPOINT_KINDS, type CheckpointKind } from "@/lib/contest-day";
import { formatDate } from "@/lib/time";
import { StepNotice, useStepEdits } from "./volunteering/station-steps";
import { copyDialog } from "@/components/confirm-dialog";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type StationValues = {
  name: string;
  checkpoint_kind: CheckpointKind | null;
  due_minutes_before_warm_up: number | null;
  location: string | null;
  instructions: string | null;
  adults_only?: boolean;
  /** School fairs: which zone the station is in. */
  zone?: string | null;
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
  zones,
  leadLabel = "Section Leads",
  trackUnsaved,
}: {
  action: Action;
  initial?: StationValues;
  leads?: LeadOption[];
  submitLabel?: string;
  /** A band contest: stations can be stops on the bands' check-in path. */
  bands?: boolean;
  /** Suggestions for Location: a group event's rooms. */
  locations?: string[];
  /** School fairs: zone suggestions (shows the Zone field). */
  zones?: readonly string[];
  /** What the station's leads are called ("Station Coordinators" at fairs). */
  leadLabel?: string;
  /** Step 2's "1. Station details": warn before leaving the station with this unsaved or unfinished. */
  trackUnsaved?: boolean;
}) {
  const [kind, setKind] = useState<string>(initial?.checkpoint_kind ?? "");
  const setEdited = useStepEdits(trackUnsaved ? "details" : undefined);
  const changed = useCallback(() => setEdited(true), [setEdited]);
  const saved = useCallback(() => setEdited(false), [setEdited]);
  return (
    <ActionForm
      action={action}
      className="grid gap-4 sm:grid-cols-2"
      resetOnSuccess={!initial}
      onEdit={trackUnsaved ? changed : undefined}
      onSuccess={trackUnsaved ? saved : undefined}
    >
      {trackUnsaved ? (
        // Step 2: the name was set in step 1 (rename it there).
        <input type="hidden" name="name" value={initial?.name ?? ""} />
      ) : (
        <Field label="Station name" hint={bands ? "e.g. Spectator Parking, Concessions, Warm-Up Area A" : "e.g. Parking, Concessions, Ticket Table"}>
          <Input name="name" required defaultValue={initial?.name} />
        </Field>
      )}
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
      {zones && (
        <Field label="Zone" hint="Optional. Groups stations on the event's pages. Use one of these or make up your own.">
          <ZoneInput zones={zones} defaultValue={initial?.zone} />
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
      <Field label="Instructions for volunteers" hint="Optional. What to wear, bring, and do." className="sm:col-span-2">
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
          <legend className="text-sm font-medium">{leadLabel}</legend>
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
      <div className="space-y-3 sm:col-span-2">
        {trackUnsaved && <StepNotice step="details" />}
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Anything typed or picked in a form (hidden fields aside). */
function hasAnswers(form: HTMLFormElement) {
  return [...form.elements].some(
    (el) => (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) && el.type !== "hidden" && el.value.trim() !== "",
  );
}

/**
 * "Auto create shifts": split each event day into equal shifts. Run again, it
 * replaces the station's shifts, as long as nobody has signed up for them.
 */
export function GenerateShiftsForm({
  action,
  windowLabel,
  existing = 0,
  signedUp = false,
}: {
  action: Action;
  windowLabel: string;
  /** How many shifts the station has now. */
  existing?: number;
  /** Someone has signed up for one of them: auto create can't replace them. */
  signedUp?: boolean;
}) {
  const setEdited = useStepEdits("shifts");
  if (signedUp) {
    return (
      <p className="rounded-md border border-border bg-background px-3 py-2.5 text-sm">
        Volunteers have signed up for this station&apos;s shifts, so auto create can&apos;t replace them. Edit shifts one at a
        time below, or create a single shift.
      </p>
    );
  }
  return (
    <ActionForm
      action={action}
      className="space-y-4"
      confirmMessage={existing ? `Replace this station's ${existing} shift${existing === 1 ? "" : "s"} with new ones?` : undefined}
      onEdit={(f) => setEdited(hasAnswers(f))}
    >
      <p className="text-sm text-muted">
        Split the event day ({windowLabel}) into equal shifts for this station.
        {existing > 0 && (
          <>
            {" "}
            <strong className="font-semibold text-foreground">
              This replaces its {existing} shift{existing === 1 ? "" : "s"}
            </strong>{" "}
            (nobody has signed up yet).
          </>
        )}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Shift length">
          <Select name="blockHours" defaultValue="" required>
            <option value="" disabled>
              Pick a length
            </option>
            {[1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>
                {h} hour{h > 1 ? "s" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Volunteers per shift">
          <NumberInput name="capacity" placeholder="e.g. 4" required />
        </Field>
      </div>
      <StepNotice step="shifts" />
      <SubmitButton variant="go" pendingText="Creating…">
        Create shifts
      </SubmitButton>
    </ActionForm>
  );
}

type ShiftValues = { title: string; day: string; startTime: string; endTime: string; capacity: number; description: string | null };

export function ShiftForm({
  action,
  days,
  initial,
  registered = 0,
  submitLabel = "Create shift",
}: {
  action: Action;
  days: string[];
  initial?: ShiftValues;
  registered?: number;
  submitLabel?: string;
}) {
  // A new shift: the button turns green once every required answer is in.
  const setEdited = useStepEdits(initial ? undefined : "shifts");
  return (
    <ActionForm
      action={action}
      className="grid gap-4 sm:grid-cols-2"
      resetOnSuccess={!initial}
      onEdit={initial ? undefined : (f) => setEdited(hasAnswers(f))}
    >
      {initial && (
        <Field label="Title" className="sm:col-span-2">
          <Input name="title" required defaultValue={initial.title} placeholder="e.g. Morning parking crew" />
        </Field>
      )}
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
        <NumberInput name="capacity" defaultValue={initial?.capacity ?? ""} placeholder="e.g. 4" required />
      </Field>
      {initial && (
        <Field label="Duties" hint="Optional." className="sm:col-span-2">
          <Textarea name="description" defaultValue={initial.description ?? ""} />
        </Field>
      )}
      <div className="space-y-3 sm:col-span-2">
        {!initial && <StepNotice step="shifts" />}
        <SubmitButton variant={initial ? "primary" : "go"} pendingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** "2. Build shifts": auto create a day of shifts, or create one shift. */
export function BuildShifts({
  generate,
  create,
  windowLabel,
  days,
  existing = 0,
  signedUp = false,
}: {
  generate: Action;
  create: Action;
  windowLabel: string;
  days: string[];
  /** The station's shifts now, and whether anyone has signed up for one. */
  existing?: number;
  signedUp?: boolean;
}) {
  const [mode, setMode] = useState<"auto" | "single">("auto");
  // Switching forms drops what was typed in the other one.
  const setEdited = useStepEdits("shifts");
  const options = [
    { value: "auto", label: "Auto create shifts" },
    { value: "single", label: "Create single shift" },
  ] as const;
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="How to build shifts" className="inline-flex rounded-md border border-border bg-background p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            onClick={() => {
              setMode(o.value);
              setEdited(false);
            }}
            className={`min-h-10 rounded-sm px-4 text-sm font-semibold transition ${
              mode === o.value ? "bg-brand text-brand-foreground shadow-card" : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {mode === "auto" ? (
        <GenerateShiftsForm action={generate} windowLabel={windowLabel} existing={existing} signedUp={signedUp} />
      ) : (
        <ShiftForm action={create} days={days} />
      )}
    </div>
  );
}

/** "1. Create stations": a station's name. Its leads are picked on its row; the rest comes in step 2. */
export function NewStationForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <Field label="New station name" hint="e.g. Parking, Concessions, Ticket Table" className="flex-1">
        <Input name="name" required maxLength={80} />
      </Field>
      <SubmitButton variant="go" pendingText="Adding…" className="sm:mb-7">
        Add station
      </SubmitButton>
    </ActionForm>
  );
}

/**
 * A station's row in "1. Create stations": its leads, with a button to
 * assign them (once the team has leads to pick from), and a rename.
 */
export function StationRow({
  name,
  leadNames,
  leadIds,
  leads,
  canAssign,
  leadWord,
  setLeads,
  rename,
  remove,
}: {
  name: string;
  leadNames: string[];
  leadIds: string[];
  leads: LeadOption[];
  /** The team has Section Leads (Station Coordinators) to assign. */
  canAssign: boolean;
  leadWord: { one: string; many: string };
  setLeads: Action;
  rename: Action;
  remove: Action;
}) {
  const [open, setOpen] = useState<"leads" | "rename" | null>(null);
  const toggle = (which: "leads" | "rename") => setOpen(open === which ? null : which);
  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted">{leadNames.length ? leadNames.join(", ") : `No ${leadWord.one} yet`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAssign && (
            <Button type="button" variant={leadNames.length ? "secondary" : "primary"} className="min-h-10 text-sm" onClick={() => toggle("leads")} aria-expanded={open === "leads"}>
              {leadNames.length ? `Change ${leadWord.many}` : `Assign a ${leadWord.one}`}
            </Button>
          )}
          <Button type="button" variant="ghost" className="min-h-10 px-2 text-sm" onClick={() => toggle("rename")} aria-expanded={open === "rename"}>
            Rename or delete
          </Button>
        </div>
      </div>
      {open === "leads" && (
        <ActionForm action={setLeads} className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3" resetOnSuccess={false} onSuccess={() => setOpen(null)}>
          <fieldset>
            <legend className="text-sm font-semibold">Who leads {name}?</legend>
            <p className="mt-0.5 text-sm text-muted">Pick one or more, so there&apos;s a backup. Volunteers contact the first one picked.</p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {leads.map((l) => (
                <label key={l.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-brand">
                  <input type="checkbox" name="leadIds" value={l.id} defaultChecked={leadIds.includes(l.id)} className="h-5 w-5 shrink-0 accent-[var(--brand)]" />
                  {l.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="go" pendingText="Saving…">
              Save
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
          </div>
        </ActionForm>
      )}
      {/* Delete lives in here, out of the way, instead of a red button on every row. */}
      {open === "rename" && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3">
          <ActionForm action={rename} className="flex flex-col gap-2 sm:flex-row sm:items-end" resetOnSuccess={false} onSuccess={() => setOpen(null)}>
            <Field label="Station name" className="flex-1">
              <Input name="name" required maxLength={80} defaultValue={name} />
            </Field>
            <div className="flex gap-2">
              <SubmitButton pendingText="Saving…">Save</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
                Cancel
              </Button>
            </div>
          </ActionForm>
          <div className="border-t border-border pt-3">
            <DeleteButton
              action={remove}
              label={`Delete station ${name}`}
              text="Delete station"
              destructive
              confirmMessage={`Delete “${name}”? Its shifts are deleted too, and this can't be undone. (A station with volunteers signed up can't be deleted.)`}
            />
          </div>
        </div>
      )}
    </li>
  );
}

export function DeleteButton({
  action,
  label,
  confirmMessage,
  text = "Delete",
  destructive = false,
  quiet = false,
}: {
  action: Action;
  label: string;
  confirmMessage: string;
  text?: string;
  /** A full-size red outlined button, for deleting something big (a whole station). */
  destructive?: boolean;
  /** Red text, no outline: a delete that shouldn't compete with the page's main actions. */
  quiet?: boolean;
}) {
  return (
    <ActionForm action={action} confirmMessage={confirmMessage} className="contents">
      <SubmitButton
        variant={quiet ? "quiet-danger" : destructive ? "danger" : "ghost"}
        pendingText={destructive || quiet ? "Deleting…" : "Working…"}
        className={destructive || quiet ? "text-sm" : "px-2 text-xs"}
        aria-label={destructive || quiet ? undefined : label}
      >
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
          schedule, volunteers, and the team.
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
          await copyDialog("Copy this invitation link", url);
        }
      }}
    >
      {copied ? "Copied" : label}
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
  /** "go" (green) and "stop" (red outline) for switching something on or off; "quiet-stop" is red text. */
  variant?: "primary" | "secondary" | "go" | "stop" | "quiet-stop";
  confirmMessage?: string;
  pendingText?: string;
}) {
  return (
    <ActionForm action={action} confirmMessage={confirmMessage} className="space-y-2" resetOnSuccess={false}>
      <SubmitButton
        variant={variant === "stop" ? "danger" : variant === "quiet-stop" ? "quiet-danger" : variant}
        pendingText={pendingText}
      >
        {children}
      </SubmitButton>
    </ActionForm>
  );
}
