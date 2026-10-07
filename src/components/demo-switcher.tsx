"use client";

import { useState, useTransition } from "react";
import { backToMe, endDemo, switchDemo } from "@/app/demo-actions";
import { Button, FormMessage } from "@/components/ui";

type Persona = { value: string; label: string };

/** Role buttons: tapping one signs this browser in as that demo person. */
function RoleButtons({
  eventId,
  personas,
  current,
  scroll,
}: {
  eventId: string;
  personas: readonly Persona[];
  current?: string;
  /** One row that scrolls sideways on phones (the demo bar). */
  scroll?: boolean;
}) {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div
        className={`flex gap-1.5 ${scroll ? "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" : "flex-wrap"}`}
        role="group"
        aria-label="View as"
      >
        {personas.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={p.value === current}
            disabled={pending}
            onClick={() => {
              setPicked(p.value);
              setError(null);
              // The demo bar is at the top of the page.
              window.scrollTo({ top: 0 });
              start(async () => {
                const r = await switchDemo(eventId, p.value);
                if (r?.error) setError(r.error);
              });
            }}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-sm font-medium transition disabled:opacity-60 ${
              p.value === current
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-surface hover:border-brand"
            }`}
          >
            {pending && picked === p.value ? "Switching…" : p.label}
          </button>
        ))}
      </div>
      {error && <FormMessage error={error} />}
    </>
  );
}

/** The bar across the top of every page while in demo mode. */
export function DemoSwitcher({
  eventId,
  eventName,
  current,
  personas,
}: {
  eventId: string | null;
  eventName: string | null;
  current: string;
  personas: readonly Persona[];
}) {
  const [leaving, start] = useTransition();
  const label = personas.find((p) => p.value === current)?.label ?? current;
  return (
    <div className="border-b border-accent bg-accent-soft">
      <div className="mx-auto max-w-5xl space-y-1.5 px-4 py-2 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm">
            <span className="mr-2 rounded bg-accent px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[#14213d]">Demo</span>
            Viewing as <strong>{label}</strong>
            {eventName && <span className="text-muted"> · {eventName}</span>}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 shrink-0 px-3"
            disabled={leaving}
            title="Signs out and emails a sign-in link to your own address"
            onClick={() => start(() => backToMe())}
          >
            {leaving ? "Sending link…" : "Back to me"}
          </Button>
        </div>
        {eventId && <RoleButtons eventId={eventId} personas={personas} current={current} scroll />}
      </div>
    </div>
  );
}

/** On an event page, for FieldCommand admins: start (or tidy up) a demo. */
export function DemoStart({ eventId, personas, active }: { eventId: string; personas: readonly Persona[]; active: boolean }) {
  const [removing, start] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);
  return (
    <div className="space-y-3">
      <RoleButtons eventId={eventId} personas={personas} />
      {active && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 px-3"
            disabled={removing}
            onClick={() => {
              if (!window.confirm("Take the demo people off this event? Their demo band and volunteer shift go too.")) return;
              start(async () => {
                const r = await endDemo(eventId);
                setMessage(r.error ? { error: r.error } : { success: r.message });
              });
            }}
          >
            {removing ? "Removing…" : "Remove demo people"}
          </Button>
          <span className="text-sm text-muted">Do this when you&apos;re done, so they don&apos;t show up in this event&apos;s lists.</span>
        </div>
      )}
      {message && <FormMessage error={message.error} success={message.success} />}
    </div>
  );
}
