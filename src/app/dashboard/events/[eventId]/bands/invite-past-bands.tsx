"use client";

import { useMemo, useState, useTransition } from "react";
import { confirmDialog } from "@/components/confirm-dialog";
import { Badge, FormMessage, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type PastDirector = {
  email: string;
  name: string;
  bands: string[];
  /** Where they come from: "Last registered for Fall Classic", "From your spreadsheet". */
  note: string;
  registered: boolean;
  /** "Invited Oct 8", once emailed. */
  invited: string | null;
  /** The last email to them couldn't be sent. */
  failed?: boolean;
};

/**
 * Hosts: choose directors (from earlier contests, or imported) and email them an invitation to
 * register, or remind the ones already invited who haven't registered. Every recipient is listed
 * and can be unticked before anything is sent; the confirmation names how many.
 */
export function InvitePastBands({
  directors,
  canSend,
  cantSendReason,
  send,
  one = "band",
  preview,
}: {
  directors: PastDirector[];
  canSend: boolean;
  /** Why invitations can't go out yet, when they can't. */
  cantSendReason?: string;
  send: (emails: string[], reminder: boolean) => Promise<ActionState>;
  /** "band" or "group". */
  one?: string;
  /** What the invitation says, for "Preview the email". */
  preview: { subject: string; paragraphs: string[]; button: string; footer: string };
}) {
  // Chosen to start: everyone not yet registered or invited.
  const [picked, setPicked] = useState(() => new Set(directors.filter((d) => !d.registered && !d.invited).map((d) => d.email)));
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>({});
  const pickable = directors.filter((d) => !d.registered);
  const invitedWaiting = directors.filter((d) => d.invited && !d.registered);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? directors.filter((d) => [d.name, d.email, ...d.bands].some((t) => t.toLowerCase().includes(q))) : directors;
  }, [directors, query]);
  const toggle = (email: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(email);
      else next.delete(email);
      return next;
    });

  const go = (emails: string[], reminder: boolean) =>
    start(async () => {
      const n = emails.length;
      const ok = await confirmDialog({
        title: reminder ? `Send ${n} ${n === 1 ? "reminder" : "reminders"}?` : `Send ${n} ${n === 1 ? "invitation" : "invitations"}?`,
        message: reminder
          ? `Each invited director who hasn't registered gets one more email. The link in their first email still works.`
          : `Each director gets one email with the registration link and the deadline. Nobody is added to your team.`,
        confirmLabel: reminder ? "Send reminders" : "Send invitations",
        cancelLabel: "Not yet",
      });
      if (!ok) return;
      const r = await send(emails, reminder);
      setResult(r);
      if (r.ok && !reminder) setPicked(new Set());
    });

  const btn = "inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold";
  return (
    <div className="space-y-4">
      {!canSend && cantSendReason && (
        <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">{cantSendReason}</p>
      )}
      <div>
        <label htmlFor="invite-search" className="sr-only">
          Search directors
        </label>
        <Input id="invite-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by school, band, or name" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <p>
          <span className="font-semibold">
            {picked.size} of {pickable.length} chosen
          </span>
          {invitedWaiting.length > 0 && <span className="text-muted"> · {invitedWaiting.length} invited, not registered yet</span>}
        </p>
        <span className="flex gap-3">
          <button type="button" className="min-h-11 font-semibold text-brand underline underline-offset-4" onClick={() => setPicked(new Set(pickable.map((d) => d.email)))}>
            Choose all
          </button>
          <button type="button" className="min-h-11 font-semibold text-brand underline underline-offset-4" onClick={() => setPicked(new Set())}>
            Choose none
          </button>
        </span>
      </div>
      <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border" aria-label="Directors">
        {shown.map((d) => (
          <li key={d.email}>
            <label className={`flex items-start gap-3 px-3 py-3 ${d.registered ? "" : "cursor-pointer hover:bg-background"}`}>
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
                checked={picked.has(d.email)}
                disabled={d.registered}
                onChange={(e) => toggle(d.email, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.bands.join(", ") || d.email}</span>
                  {d.registered ? (
                    <Badge tone="success">Registered</Badge>
                  ) : d.failed ? (
                    <Badge tone="warning">Couldn&apos;t send · check the address</Badge>
                  ) : (
                    d.invited && <Badge tone="info">{d.invited}</Badge>
                  )}
                </span>
                <span className="block break-all text-sm text-muted">{[d.name, d.email].filter(Boolean).join(" · ")}</span>
                <span className="block text-xs text-muted">{d.note}</span>
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-4 text-sm text-muted">No directors match “{query}”.</li>}
      </ul>
      <p className="text-sm">
        Someone else?{" "}
        <a href="#import" className="font-semibold text-brand underline underline-offset-4">
          Import a spreadsheet of directors
        </a>
      </p>
      <FormMessage error={result.error} success={result.message} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canSend || picked.size === 0 || pending}
          onClick={() => go([...picked], false)}
          className={`${btn} bg-brand text-brand-foreground hover:bg-brand-hover disabled:cursor-not-allowed disabled:border-[1.5px] disabled:border-dashed disabled:border-field-border disabled:bg-transparent disabled:text-disabled`}
        >
          {pending ? "Sending…" : `Send ${picked.size} ${picked.size === 1 ? "invitation" : "invitations"}`}
        </button>
        {invitedWaiting.length > 0 && (
          <button
            type="button"
            disabled={!canSend || pending}
            onClick={() => go(invitedWaiting.map((d) => d.email), true)}
            className={`${btn} border-[1.5px] border-field-border bg-surface hover:border-brand disabled:cursor-not-allowed disabled:border-dashed disabled:text-disabled`}
          >
            Remind {invitedWaiting.length} who haven&apos;t registered
          </button>
        )}
      </div>
      <details className="group text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold text-brand">
          <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
            ›
          </span>
          Preview the email
        </summary>
        <div className="mt-2 rounded-lg border border-border bg-background p-4 leading-6">
          <p className="font-semibold">{preview.subject}</p>
          {preview.paragraphs.map((p) => (
            <p key={p} className="mt-2">
              {p}
            </p>
          ))}
          <p className="mt-3">
            <span className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 font-semibold text-brand-foreground">{preview.button}</span>
          </p>
          <p className="mt-3 text-xs text-muted">{preview.footer}</p>
        </div>
      </details>
      <p className="text-xs text-muted">
        The button in each email signs the director in once, within 7 days, with their {one}&apos;s details filled in. After
        that, they confirm their email with a code. Sending again keeps the earlier link working.
      </p>
    </div>
  );
}
