"use client";

import { useState } from "react";
import { ActionForm, useFieldErrors } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

/** Email settings → Who emails come from: the person they're from, and replies on (to an address) or off. */
export function RepliesForm({
  action,
  replies,
  replyTo,
  who,
  senders = [],
  sender = null,
  bare = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  replies: boolean;
  replyTo: string;
  /** Who gets this event's emails: "Band directors and volunteers". */
  who: string;
  /** The account's hosts, each with how the emails would show ("Becca Smith, Boosters via Field Command Events"). */
  senders?: { id: string; label: string; shownAs: string }[];
  /** Who they come from now. */
  sender?: string | null;
  /** Just the fields, inside a form around it that saves them (the guided setup's Email settings step). */
  bare?: boolean;
}) {
  const [on, setOn] = useState(replies);
  const [from, setFrom] = useState(sender ?? senders[0]?.id ?? "");
  const shownAs = senders.find((x) => x.id === from)?.shownAs;
  const options = [
    {
      value: true,
      label: "Replies go to an email",
      hint: `${who} who reply see this address.`,
    },
    {
      value: false,
      label: "No replies",
      hint: "Emails come from a no-reply address. People reach you another way, like your event page.",
    },
  ];
  const fields = (
    <>
      {senders.length > 0 && (
        <div className="space-y-2">
          <Field label="Emails come from" hint="Their name goes first, then who they're with. Only hosts and co-hosts are listed.">
            <Select name="sender" required value={from} onChange={(e) => setFrom(e.target.value)}>
              {senders.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
          {shownAs && (
            <p className="rounded-md bg-brand-soft px-3 py-2 text-sm">
              Shows as <span className="font-semibold">{shownAs}</span>
            </p>
          )}
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Replies</legend>
        {options.map((o) => (
          <label
            key={o.label}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${on === o.value ? "border-brand bg-brand-soft" : "border-field-border"}`}
          >
            <input
              type="radio"
              name="replies"
              value={o.value ? "on" : "off"}
              checked={on === o.value}
              onChange={() => setOn(o.value)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
            />
            <span>
              <span className="block font-semibold">{o.label}</span>
              <span className="block text-sm text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <ReplyToField defaultValue={replyTo} hidden={!on} />
    </>
  );
  if (bare) return <div className="space-y-4">{fields}</div>;
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-4">
      {fields}
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}

function ReplyToField({ defaultValue, hidden }: { defaultValue: string; hidden: boolean }) {
  const error = useFieldErrors().replyTo;
  return (
    <div hidden={hidden}>
      <Field
        label="Reply email"
        hint="A work or shared address, like your school email or info@boosters.org, keeps your personal inbox private."
        error={error}
        errorId="reply-to-error"
      >
        <Input
          name="replyTo"
          type="email"
          autoComplete="email"
          defaultValue={defaultValue}
          required={!hidden}
          aria-describedby={error ? "reply-to-error" : undefined}
        />
      </Field>
    </div>
  );
}
