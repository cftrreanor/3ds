"use client";

import { useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { ActionForm } from "@/components/action-form";
import { CopyLink } from "@/components/copy-link";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** The secondary look for a row's buttons: 44 px tall, 14 px words (L12). */
const ROW_BUTTON = "min-h-11 px-3 text-sm";

/** A window opened by a button, closed by Escape, a click outside, or its way-out button. */
function useWindow() {
  const ref = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(0);
  return {
    ref,
    key,
    open: () => {
      // A fresh form each time it opens.
      setKey((k) => k + 1);
      ref.current?.showModal();
    },
    close: () => ref.current?.close(),
  };
}

function Window({
  dialogRef,
  formKey,
  close,
  title,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  formKey: number;
  close: () => void;
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={id}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-0 text-left text-foreground shadow-elevated backdrop:bg-[#071a31]/50"
    >
      <div key={formKey} className="p-6">
        <h2 id={id} className="text-lg font-semibold leading-7">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

/** "Invite a co-host": the one filled button on the page, or a greyed-out one saying why not. */
export function InviteCoHostButton({ action, spotNote, blockedBy, powers }: { action: Action; spotNote: string; blockedBy: string | null; powers: string }) {
  const { ref, key, open, close } = useWindow();
  if (blockedBy) {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <button
          type="button"
          aria-disabled
          aria-describedby="invite-co-host-blocked"
          className="inline-flex min-h-11 cursor-not-allowed items-center rounded-md border border-dashed border-border px-4 text-sm font-semibold text-disabled"
        >
          Invite a co-host
        </button>
        <p id="invite-co-host-blocked" className="text-sm text-muted">
          {blockedBy}
        </p>
      </div>
    );
  }
  return (
    <>
      <Button type="button" onClick={open}>
        Invite a co-host
      </Button>
      <Window dialogRef={ref} formKey={key} close={close} title="Invite a co-host">
        <p className="mt-2 text-sm leading-6">{powers}</p>
        <ActionForm action={action} onSuccess={close} className="mt-4 space-y-4">
          <Field label="Their email" hint={spotNote}>
            <Input name="email" type="email" required autoComplete="off" inputMode="email" />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Not now
            </Button>
            <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
          </div>
        </ActionForm>
      </Window>
    </>
  );
}

/** A row's plain button that runs one action (Resend), with a question first when given. */
export function RowButton({
  action,
  children,
  pendingText,
  confirm,
  confirmLabel,
  label,
}: {
  action: Action;
  children: ReactNode;
  pendingText: string;
  /** "The question? What happens." */
  confirm?: string;
  confirmLabel?: string;
  label?: string;
}) {
  return (
    <ActionForm action={action} confirmMessage={confirm} confirmLabel={confirmLabel} resetOnSuccess={false} className="contents">
      <SubmitButton variant="secondary" pendingText={pendingText} className={ROW_BUTTON} aria-label={label}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}

/** Copy link, on every invitation: for sending it yourself when the email didn't arrive. */
export function CopyInviteLink({ url }: { url: string }) {
  return (
    <CopyLink
      url={url}
      label="Copy link"
      className={`inline-flex items-center justify-center rounded-md border border-border bg-surface font-semibold hover:border-brand/40 hover:bg-background ${ROW_BUTTON}`}
    />
  );
}

export type RemoveChoice = {
  /** "eventId:role" */
  value: string;
  /** "Volunteer Lead · Lone Star Marching Invitational" */
  label: string;
  /** What's left empty: "Ring toss will need a new Coordinator." */
  leaves: string[];
};

/**
 * "Remove…": one quiet button per person. The window names each role, what removing it leaves
 * empty, and what stays; the red button says exactly what it removes.
 */
export function RemovePersonButton({ name, firstName, choices, action }: { name: string; firstName: string; choices: RemoveChoice[]; action: Action }) {
  const { ref, key, open, close } = useWindow();
  const one = choices.length === 1;
  const [pick, setPick] = useState<string>(one ? choices[0].value : "all");
  const chosen = pick === "all" ? choices : choices.filter((c) => c.value === pick);
  const kept = pick === "all" ? [] : choices.filter((c) => c.value !== pick);
  const leaves = chosen.flatMap((c) => c.leaves);
  const events = new Set(chosen.map((c) => c.value.split(":")[0])).size;
  return (
    <>
      <Button type="button" variant="secondary" className={ROW_BUTTON} onClick={() => {
          setPick(one ? choices[0].value : "all");
          open();
        }}>
        Remove…
      </Button>
      <Window dialogRef={ref} formKey={key} close={close} title={one ? `Remove ${name} as ${choices[0].label}?` : `Remove ${name}?`}>
        <ActionForm action={action} onSuccess={close} className="mt-3 space-y-4">
          {one ? (
            <input type="hidden" name="pick" value={choices[0].value} />
          ) : (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">Remove them from</legend>
              {[{ value: "all", label: `Every role below (${choices.length})`, leaves: [] }, ...choices].map((c) => (
                <label key={c.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-background">
                  <input
                    type="radio"
                    name="pick"
                    value={c.value}
                    checked={pick === c.value}
                    onChange={() => setPick(c.value)}
                    className="size-4 shrink-0 accent-[var(--brand)]"
                  />
                  {c.label}
                </label>
              ))}
            </fieldset>
          )}
          <div className="space-y-2 text-sm leading-6">
            <p>
              {firstName} loses access {events === 1 ? "to that event" : `to those ${events} events`} right away
              {kept.length > 0 ? <>, and stays on as {kept.map((k) => k.label).join(" and ")}.</> : "."}
            </p>
            {leaves.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {leaves.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            <p className="text-muted">We don&apos;t email {firstName}. You can invite them again from Removed recently.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Keep {firstName}
            </Button>
            <SubmitButton variant="warn" pendingText="Removing…">
              {events === 1 ? "Remove from this event" : `Remove from ${events} events`}
            </SubmitButton>
          </div>
        </ActionForm>
      </Window>
    </>
  );
}

/** "Invite again": a co-host straight away, or a Volunteer Lead or Coordinator to an event picked here. */
export function InviteAgainButton({
  email,
  roleLabel,
  events,
  defaultEventId,
  action,
}: {
  email: string;
  roleLabel: string;
  /** Events that aren't over; none for a co-host (they join the whole account). */
  events: { id: string; name: string }[] | null;
  defaultEventId?: string | null;
  action: Action;
}) {
  const { ref, key, open, close } = useWindow();
  if (!events) {
    return (
      <RowButton action={action} pendingText="Sending…" confirm={`Invite ${email} to be a co-host again? We'll email them a new invitation.`} confirmLabel="Send invitation">
        Invite again
      </RowButton>
    );
  }
  if (!events.length) return <p className="text-sm text-muted">Add an event to invite them again</p>;
  return (
    <>
      <Button type="button" variant="secondary" className={ROW_BUTTON} onClick={open}>
        Invite again
      </Button>
      <Window dialogRef={ref} formKey={key} close={close} title={`Invite ${email} again`}>
        <ActionForm action={action} onSuccess={close} className="mt-3 space-y-4">
          <p className="text-sm leading-6">We&apos;ll email them an invitation to be a {roleLabel}.</p>
          <Field label="Event">
            <Select name="eventId" required defaultValue={events.some((e) => e.id === defaultEventId) ? (defaultEventId ?? "") : (events[0]?.id ?? "")}>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Not now
            </Button>
            <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
          </div>
        </ActionForm>
      </Window>
    </>
  );
}
