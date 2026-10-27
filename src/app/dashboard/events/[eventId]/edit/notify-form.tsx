"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Button, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import type { NotifyKind } from "@/lib/notify-kinds";

export type TeamMember = { id: string; name: string; email: string | null; role: string };
type Kind = { kind: NotifyKind; label: string; hint: string };
type Extra = { key: number; email: string; kinds: NotifyKind[] };

/**
 * Edit details → Email settings → Who gets notifications: each person on the
 * team, and each other address, with a tick for each kind of email.
 */
export function NotifyForm({
  action,
  kinds,
  members,
  picked,
  extras: initialExtras,
  max,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  kinds: Kind[];
  members: TeamMember[];
  /** Who's ticked now for each kind (the saved choice, or who gets them today). */
  picked: Partial<Record<NotifyKind, string[]>>;
  extras: { email: string; kinds: NotifyKind[] }[];
  max: number;
}) {
  const [extras, setExtras] = useState<Extra[]>(() => initialExtras.map((x, i) => ({ key: i, ...x })));
  const [nextKey, setNextKey] = useState(initialExtras.length);
  const one = kinds.length === 1;

  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-5">
      <ul className="space-y-1 text-sm text-muted">
        {kinds.map((k) => (
          <li key={k.kind}>
            <span className="font-semibold text-foreground">{k.label}:</span> {k.hint}.
          </li>
        ))}
      </ul>

      <fieldset>
        <legend className="text-sm font-semibold">Your team</legend>
        <ul className="mt-2 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="rounded-lg border border-field-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{m.name}</span>
                <span className="text-muted">· {m.role}</span>
                <span className="w-full break-all text-muted">{m.email ?? "No email on file"}</span>
              </div>
              <KindChecks kinds={kinds} name={(k) => k} value={m.id} checked={(k) => picked[k]?.includes(m.id) ?? false} disabled={!m.email} one={one} who={m.name} />
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Other email addresses (optional, up to {max})</legend>
        <p className="mt-1 text-sm text-muted">
          Like your front office. They get the same emails, including names and notes, so add only people you trust with them.
          {kinds.some((k) => k.kind === "bookings") && " Families are told their details go to the people you choose."}
        </p>
        <ul className="mt-2 space-y-2">
          {extras.map((x, i) => (
            <li key={x.key} className="rounded-lg border border-field-border px-3 py-2 text-sm">
              <div className="flex gap-2">
                <Input
                  name="extra"
                  type="email"
                  defaultValue={x.email}
                  placeholder="office@school.org"
                  aria-label="Email address"
                  autoComplete="off"
                  className="min-w-0 flex-1"
                />
                <Button type="button" variant="ghost" onClick={() => setExtras((list) => list.filter((y) => y.key !== x.key))}>
                  Remove
                </Button>
              </div>
              <KindChecks kinds={kinds} name={() => `extraKinds-${i}`} checked={(k) => x.kinds.includes(k)} one={one} who="this address" />
            </li>
          ))}
        </ul>
        {extras.length < max && (
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              setExtras((list) => [...list, { key: nextKey, email: "", kinds: kinds.map((k) => k.kind) }]);
              setNextKey((n) => n + 1);
            }}
          >
            + Add an email address
          </Button>
        )}
      </fieldset>

      <SubmitButton>Save notifications</SubmitButton>
    </ActionForm>
  );
}

/** A tick for each kind of email (one plain checkbox when the event sends only one kind). */
function KindChecks({
  kinds,
  name,
  value,
  checked,
  disabled,
  one,
  who,
}: {
  kinds: Kind[];
  name: (kind: NotifyKind) => string;
  value?: string;
  checked: (kind: NotifyKind) => boolean;
  disabled?: boolean;
  one: boolean;
  who: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {kinds.map((k) => (
        <label key={k.kind} className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name={name(k.kind)}
            value={value ?? k.kind}
            defaultChecked={checked(k.kind)}
            disabled={disabled}
            aria-label={one ? `${who} gets ${k.label.toLowerCase()}` : undefined}
            className="h-4 w-4 shrink-0 accent-[var(--brand)]"
          />
          {one ? `Gets ${k.label.toLowerCase()}` : k.label}
        </label>
      ))}
    </div>
  );
}
