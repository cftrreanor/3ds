"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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
  /** Everyone leading this sign-up, first-added first. */
  lead_ids?: string[];
};
export type LeadOption = { id: string; label: string };

export function StationForm({
  action,
  initial,
  leads,
  submitLabel = "Add sign-up",
  bands = true,
  locations = [],
  zones,
  leadLabel = "Coordinators",
  trackUnsaved,
  draft = false,
  remaining = [],
  kind: signupKind,
  coordinators,
}: {
  action: Action;
  initial?: StationValues;
  leads?: LeadOption[];
  /** Time slots or items to bring, and why it can't change right now (null if it can). */
  kind?: { value: SignupKind; locked: string | null };
  /** Who leads it, picked from the team, with a window to invite someone new. */
  coordinators?: { options: LeadOption[]; pending: string[]; invite: Action };
  submitLabel?: string;
  /** A band contest: sign-ups can be stops on the bands' check-in path. */
  bands?: boolean;
  /** Suggestions for Location: a group event's rooms. */
  locations?: string[];
  /** School fairs: zone suggestions (shows the Zone field). */
  zones?: readonly string[];
  /** What the sign-up's leads are called. */
  leadLabel?: string;
  /** On a sign-up's tab: warn before leaving with changes unsaved, and save from a bar pinned to the bottom of the section. */
  trackUnsaved?: boolean;
  /** Not finished yet: never saved with Save sign-up. */
  draft?: boolean;
  /** What's still to do for this sign-up, shown in its save bar ("add items to bring"). */
  remaining?: string[];
}) {
  const [kind, setKind] = useState<string>(initial?.checkpoint_kind ?? "");
  const [signup, setSignup] = useState<SignupKind>(signupKind?.value ?? "shifts");
  const setEdited = useStepEdits(trackUnsaved ? "details" : undefined);
  const [dirty, setDirty] = useState(false);
  const changed = useCallback(() => {
    setDirty(true);
    setEdited(true);
  }, [setEdited]);
  const saved = useCallback(() => {
    setDirty(false);
    setEdited(false);
  }, [setEdited]);
  return (
    <ActionForm
      id={trackUnsaved ? SIGNUP_FORM : undefined}
      action={action}
      className="grid gap-4 sm:grid-cols-2"
      resetOnSuccess={!initial}
      onEdit={trackUnsaved ? changed : undefined}
      onSuccess={trackUnsaved ? saved : undefined}
    >
      <Field
        label="Sign-up name"
        hint={bands ? "e.g. Spectator Parking, Concessions, Warm-Up Area A" : "e.g. Parking, Concessions, Ticket Table"}
        className={signupKind ? "sm:col-span-2" : undefined}
      >
        <Input name="name" required maxLength={80} defaultValue={initial?.name} />
      </Field>
      {signupKind && (
        <div className="sm:col-span-2">
          <SignupKindPicker
            value={signup}
            onChange={setSignup}
            disabled={Boolean(signupKind.locked)}
            note={signupKind.locked ?? "You can change this until you add time slots or items."}
          />
          {/* A locked choice still says what it is, so saving never changes it. */}
          {signupKind.locked && <input type="hidden" name="signupKind" value={signup} />}
        </div>
      )}
      {signupKind && <h3 className="border-t border-border pt-4 text-base font-semibold sm:col-span-2">Sign-up details</h3>}
      {bands && (
      <Field
        label="Check-in stop?"
        hint="Check-in stops are the places a band goes through on contest day, in the order you set. Their Coordinators tap bands in."
      >
        <Select name="checkpointKind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">No, a regular sign-up (concessions, hospitality…)</option>
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
        <Field label="Zone" hint="Optional. Groups sign-ups on the event's pages. Use one of these or make up your own.">
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
          <span className="block text-muted">No one under 18 can sign up for this sign-up&apos;s shifts or be added as a walk-up, e.g. Parking.</span>
        </span>
      </label>
      {coordinators && <CoordinatorPicker label={leadLabel} initial={initial?.lead_ids ?? []} onChange={trackUnsaved ? changed : undefined} {...coordinators} />}
      {leads && (
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">{leadLabel}</legend>
          <input type="hidden" name="leadsField" value="1" />
          <p className="mt-1 text-sm text-muted">
            {leads.length
              ? "Pick one or more, so there's a backup if someone can't make it. Every lead sees this sign-up's volunteers; volunteers contact the first lead you added."
              : "Invite Coordinators in the Team card on the event page."}
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
      {trackUnsaved ? (
        <SignupBar dirty={dirty} draft={draft} remaining={remaining} submitLabel={submitLabel} />
      ) : (
        <div className="sm:col-span-2">
          <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

const SIGNUP_FORM = "signup-details";
const noSubscribe = () => () => {};

/**
 * A sign-up's footer: pinned to the bottom of the screen for the whole sign-up (resting at the end of its card),
 * saying what's left and saving its details form. Rendered into the card's #signup-bar slot.
 */
function SignupBar({ dirty, draft, remaining, submitLabel }: { dirty: boolean; draft: boolean; remaining: string[]; submitLabel: string }) {
  const slot = useSyncExternalStore(
    noSubscribe,
    () => document.getElementById("signup-bar"),
    () => null,
  );
  if (!slot) return null;
  const left = remaining.length ? new Intl.ListFormat("en", { type: "conjunction" }).format(remaining) : "";
  return createPortal(
    <div className="space-y-2 rounded-b-lg border-t-2 border-border bg-surface px-4 py-3 shadow-[0_-6px_16px_rgb(0_0_0/0.10)] sm:px-6">
      <StepNotice step="details" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex w-full min-w-0 items-start gap-2 text-sm sm:w-auto sm:flex-1" aria-live="polite">
          {dirty || remaining.length ? (
            <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#f5b301] ring-1 ring-warning/50" />
          ) : (
            <span aria-hidden className="font-bold text-success">
              ✓
            </span>
          )}
          <span className="min-w-0">
            {dirty ? (
              <>
                <span className="font-semibold">Unsaved changes</span>
                {left && <span className="text-muted"> · Still to do: {left}</span>}
              </>
            ) : remaining.length ? (
              <>
                <span className="font-semibold">What&apos;s left:</span> {left[0].toUpperCase() + left.slice(1)}
              </>
            ) : (
              <span className="font-semibold">Ready for sign-ups</span>
            )}
          </span>
        </p>
        <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
          {/* Always there; usable once there's something to save. Keeps it without marking the sign-up finished. */}
          <SubmitButton form={SIGNUP_FORM} variant="secondary" name="intent" value="later" pendingText="Saving…" disabled={!dirty && !draft}>
            Save for later
          </SubmitButton>
          <SubmitButton form={SIGNUP_FORM} pendingText="Saving…" disabled={!dirty && !draft}>
            {submitLabel}
          </SubmitButton>
        </div>
      </div>
    </div>,
    slot,
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
 * replaces the sign-up's shifts, as long as nobody has signed up for them.
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
        Volunteers have signed up for this sign-up&apos;s time slots, so filling the day can&apos;t replace them. Edit them one at a time above, or add one shift.
      </p>
    );
  }
  return (
    <ActionForm
      action={action}
      className="space-y-4"
      confirmMessage={existing ? `Replace this sign-up's ${existing} shift${existing === 1 ? "" : "s"} with new ones?` : undefined}
      onEdit={(f) => setEdited(hasAnswers(f))}
    >
      <p className="text-sm text-muted">
        Split the event day ({windowLabel}) into equal shifts for this sign-up.
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
  /** The sign-up's shifts now, and whether anyone has signed up for one. */
  existing?: number;
  signedUp?: boolean;
}) {
  const [mode, setMode] = useState<"auto" | "single">("auto");
  // Switching forms drops what was typed in the other one.
  const setEdited = useStepEdits("shifts");
  const options = [
    { value: "auto", label: "Fill the day with shifts" },
    { value: "single", label: "Add one shift" },
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

/** "1. Create stations": a sign-up's name. Its leads are picked on its row; the rest comes in step 2. */
/** A station signs people up for times (shifts) or for things to bring (items). */
const SIGNUP_KINDS = [
  { value: "shifts", label: "Time slots", hint: "People sign up for a time, like setting up from 5 to 6 PM" },
  { value: "items", label: "Items to bring", hint: "People sign up to bring something, like desserts or drinks" },
] as const;

type SignupKind = "shifts" | "items";

/** Time slots or items to bring, as two big choices. */
function SignupKindPicker({
  value,
  onChange,
  disabled = false,
  note,
}: {
  value: SignupKind;
  onChange: (kind: SignupKind) => void;
  disabled?: boolean;
  note: string;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-semibold">What do people sign up for?</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {SIGNUP_KINDS.map((k) => (
          <label
            key={k.value}
            className={`flex gap-3 rounded-lg border p-3 ${disabled ? "opacity-60" : "cursor-pointer"} ${value === k.value ? "border-brand bg-brand-soft" : "border-field-border"}`}
          >
            <input
              type="radio"
              name="signupKind"
              value={k.value}
              checked={value === k.value}
              onChange={() => onChange(k.value)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
            />
            <span>
              <span className="block text-sm font-semibold">{k.label}</span>
              <span className="block text-sm text-muted">{k.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-sm text-muted">{note}</p>
    </fieldset>
  );
}

/** "Time slots" or "Items to bring", for a sign-up's row. */
export const signupKindLabel = (kind: SignupKind) => SIGNUP_KINDS.find((k) => k.value === kind)!.label;

export function NewStationForm({ action, openTab = false }: { action: Action; /** Go to the new sign-up's tab once it's added. */ openTab?: boolean }) {
  const [kind, setKind] = useState<SignupKind>("shifts");
  return (
    <ActionForm action={action} className="space-y-4">
      {openTab && <input type="hidden" name="openTab" value="1" />}
      <Field
        label="Sign-up name"
        hint={kind === "items" ? "e.g. Potluck, Bake Sale, Supply Drive" : "e.g. Parking, Concessions, Ticket Table"}
      >
        <Input name="name" required maxLength={80} />
      </Field>
      <SignupKindPicker value={kind} onChange={setKind} note="You can change this later, until you add time slots or items." />
      <SubmitButton variant="go" pendingText="Adding…">
        Add sign-up
      </SubmitButton>
    </ActionForm>
  );
}

/** Items to bring: one row per item (Desserts, 6 needed), edited right in the row, and a row to add another. */
export function ItemsEditor({
  items,
  create,
}: {
  /** Each item with its own save and delete (bound on the server). */
  items: { id: string; name: string; needed: number; claimed_count: number; update: Action; remove: () => Promise<ActionState> }[];
  create: Action;
}) {
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem_9rem] gap-3 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
        <span>Item</span>
        <span>Needed</span>
        <span>Signed up</span>
        <span />
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className="px-3 py-2.5">
            <ActionForm
              action={it.update}
              resetOnSuccess={false}
              className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_9rem]"
            >
              <Input name="name" required maxLength={100} defaultValue={it.name} aria-label="Item" />
              <NumberInput name="needed" required defaultValue={it.needed} maxLength={3} aria-label={`How many ${it.name} needed`} />
              <span className="text-sm tabular-nums text-muted">
                {it.claimed_count >= it.needed ? <span className="font-medium text-success">Covered</span> : `${it.claimed_count} of ${it.needed}`}
              </span>
              <span className="flex items-center justify-end gap-1">
                <SubmitButton variant="secondary" pendingText="Saving…" className="min-h-9 px-3 text-sm">
                  Save
                </SubmitButton>
                <DeleteButton action={it.remove} label={`Delete ${it.name}`} confirmMessage={`Delete “${it.name}”?`} />
              </span>
            </ActionForm>
          </li>
        ))}
        <li className="px-3 py-2.5">
          <ActionForm action={create} resetOnSuccess className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_9rem]">
            <Input name="name" required maxLength={100} placeholder={items.length ? "Add another item" : "Add an item, e.g. Desserts"} aria-label="New item" />
            <NumberInput name="needed" required defaultValue={1} maxLength={3} aria-label="How many needed" />
            <span className="hidden sm:block" />
            <span className="flex justify-end">
              <SubmitButton variant="go" pendingText="Adding…" className="min-h-9 px-4 text-sm">
                Add
              </SubmitButton>
            </span>
          </ActionForm>
        </li>
      </ul>
    </div>
  );
}

/**
 * A sign-up's Coordinators: who leads it, as chips, and "+ Add", which opens a
 * window to pick people from the team or invite someone new by email (the
 * invitation also shows in Event settings → Team). Picks are saved with the
 * sign-up's Save button; an invitation goes out right away.
 */
function CoordinatorPicker({
  label,
  initial,
  options,
  pending,
  invite,
  onChange,
}: {
  label: string;
  initial: string[];
  options: LeadOption[];
  /** Emails invited to lead this sign-up who haven't accepted yet. */
  pending: string[];
  invite: Action;
  onChange?: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  // The window is only on the page while it's open.
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameOf = (id: string) => options.find((o) => o.id === id)?.label ?? "Team member";
  const toggle = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    onChange?.();
  };
  // The window sits outside this form on the page, so typing in it doesn't count as editing the sign-up.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div className="sm:col-span-2">
      <p className="text-sm font-medium">{label}</p>
      <input type="hidden" name="leadsField" value="1" />
      {picked.map((id) => (
        <input key={id} type="hidden" name="leadIds" value={id} />
      ))}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {picked.map((id) => (
          <span key={id} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface pl-3 text-sm">
            {nameOf(id)}
            <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${nameOf(id)}`} className="min-h-9 rounded-full px-2.5 text-muted hover:text-danger">
              ×
            </button>
          </span>
        ))}
        {pending.map((email) => (
          <span key={email} className="inline-flex min-h-9 items-center rounded-full border border-dashed border-border px-3 text-sm text-muted">
            {email} · invited
          </span>
        ))}
        <Button type="button" variant="secondary" className="min-h-9 px-3 text-sm" onClick={() => setOpen(true)}>
          + Add
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">They see who&apos;s signed up, and volunteers&apos; phone numbers on event day. Volunteers contact the first one.</p>
      {open &&
        createPortal(
          <dialog
            ref={(el) => {
              dialog.current = el;
              if (el && !el.open) el.showModal();
            }}
            onClose={() => setOpen(false)}
            aria-label={`Add ${label}`}
            onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
            onInput={stop}
            onChange={stop}
            onSubmit={stop}
            className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-elevated backdrop:bg-[#071a31]/50"
          >
            <div className="space-y-6 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">Add {label}</h2>
                <button type="button" onClick={() => dialog.current?.close()} className="min-h-10 rounded-md px-2 text-sm font-medium text-muted hover:text-foreground">
                  Close
                </button>
              </div>
              <section>
                <h3 className="text-sm font-semibold">From your team</h3>
                {options.length ? (
                  <div className="mt-2 space-y-1.5">
                    {options.map((o) => (
                      <label key={o.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-brand">
                        <input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} className="h-5 w-5 shrink-0 accent-[var(--brand)]" />
                        {o.label}
                      </label>
                    ))}
                    <p className="text-xs text-muted">Click Save sign-up afterward to keep these.</p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted">No one on the team yet. Invite someone below.</p>
                )}
              </section>
              <section className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Invite someone new</h3>
                <p className="mt-0.5 text-sm text-muted">
                  We email them an invitation. One tap accepts it, and they lead this sign-up. They also appear in Event settings → Team.
                </p>
                <ActionForm action={invite} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Field label="Their email" className="flex-1">
                    <Input name="email" type="email" inputMode="email" autoComplete="off" required />
                  </Field>
                  <SubmitButton pendingText="Sending…" className="sm:mb-0.5">
                    Send invitation
                  </SubmitButton>
                </ActionForm>
              </section>
              <div className="flex justify-end">
                <Button type="button" onClick={() => dialog.current?.close()}>
                  Done
                </Button>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </div>
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
        <Field label="Sign-up they'll lead" hint="Optional. You can also choose later.">
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
