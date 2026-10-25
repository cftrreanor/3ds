"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";
import { INVITE_PACKAGES, INVITE_STATUSES } from "@/lib/invitation-plan";

// The admin kit's smallInput (kit.tsx is server-only).
const smallInput =
  "h-8 rounded-sm border border-border bg-surface px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

/**
 * The host invitation, with the package and pilot length they'll start on.
 * Send (or send again) emails them; Save changes only the choices.
 */
export function InvitationPlanForm({
  action,
  email,
  name,
  invited,
  pkg,
  status,
  freeUntil,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  email: string;
  name: string;
  /** An invitation is waiting (not used yet). */
  invited: boolean;
  pkg: string;
  status: string;
  freeUntil: string;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={false} className="mt-2 space-y-2 text-sm">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="name" value={name} />
      <label className="block">
        <span className="text-xs font-semibold text-muted">Package</span>
        <select name="package" defaultValue={pkg} className={`${smallInput} mt-0.5 w-full`}>
          {INVITE_PACKAGES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-muted">Plan status</span>
        <select name="status" defaultValue={status} className={`${smallInput} mt-0.5 w-full`}>
          {INVITE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-muted">Free through</span>
        <input type="date" name="freeUntil" required defaultValue={freeUntil} className={`${smallInput} mt-0.5 w-full`} />
      </label>
      <SubmitButton name="intent" value="send" variant={invited ? "secondary" : "primary"} className="h-8 min-h-8! w-full rounded-sm px-3" pendingText="Saving…">
        {invited ? "Send the invitation again" : "Approve as host"}
      </SubmitButton>
      {invited && (
        <SubmitButton name="intent" value="save" variant="secondary" className="h-8 min-h-8! w-full rounded-sm px-3" pendingText="Saving…">
          Save without sending
        </SubmitButton>
      )}
    </ActionForm>
  );
}
