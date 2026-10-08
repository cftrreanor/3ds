"use client";

import { useState, useTransition } from "react";
import { Badge, Button, FormMessage } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type PastDirector = {
  email: string;
  name: string;
  bands: string[];
  lastEvent: string;
  registered: boolean;
  /** "Invited Oct 8", once emailed. */
  invited: string | null;
};

/** Hosts: pick directors from earlier events and email them an invitation to register. */
export function InvitePastBands({
  directors,
  canSend,
  send,
}: {
  directors: PastDirector[];
  canSend: boolean;
  send: (emails: string[]) => Promise<ActionState>;
}) {
  // Ticked to start: everyone not yet registered or invited.
  const [picked, setPicked] = useState(() => new Set(directors.filter((d) => !d.registered && !d.invited).map((d) => d.email)));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>({});
  const pickable = directors.filter((d) => !d.registered);
  const toggle = (email: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(email);
      else next.delete(email);
      return next;
    });

  return (
    <div className="space-y-4">
      {!canSend && (
        <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
          Publish the event and open band registration to send invitations.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">
          {picked.size} of {pickable.length} selected
        </span>
        <button type="button" className="min-h-9 font-medium text-brand hover:underline" onClick={() => setPicked(new Set(pickable.map((d) => d.email)))}>
          Select all
        </button>
        <button type="button" className="min-h-9 font-medium text-brand hover:underline" onClick={() => setPicked(new Set())}>
          Select none
        </button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {directors.map((d) => (
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
                  <span className="font-medium">{d.name || d.email}</span>
                  {d.registered ? <Badge tone="success">Registered</Badge> : d.invited && <Badge tone="info">{d.invited}</Badge>}
                </span>
                {d.name && <span className="block text-sm text-muted">{d.email}</span>}
                <span className="block text-sm">{d.bands.join(", ")}</span>
                <span className="block text-xs text-muted">Last registered for {d.lastEvent}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <FormMessage error={result.error} success={result.message} />
      <Button
        type="button"
        disabled={!canSend || picked.size === 0 || pending}
        onClick={() =>
          start(async () => {
            const r = await send([...picked]);
            setResult(r);
            if (r.ok) setPicked(new Set());
          })
        }
      >
        {pending ? "Sending…" : `Send ${picked.size} invitation${picked.size === 1 ? "" : "s"}`}
      </Button>
      <p className="text-xs text-muted">
        Each email has a button that signs the director in (once, for 30 days) and shows their saved band, ready to register
        in one tap. Sending again replaces the earlier link.
      </p>
    </div>
  );
}
