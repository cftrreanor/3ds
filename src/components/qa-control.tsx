"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createScenario, resetMyEvents } from "@/app/qa/control-actions";
import { RoleButtons } from "@/components/demo-switcher";
import { Button, FormMessage } from "@/components/ui";
import { PUBLIC_PAGES, SCENARIOS, SITE_PAGES, type Scenario } from "@/lib/qa-scenarios";
import { confirmDialog } from "@/components/confirm-dialog";

export type QaEvent = {
  id: string;
  name: string;
  slug: string;
  type: Scenario["type"];
  published: boolean;
  personas: { value: string; label: string }[];
};

const noChange = () => () => {};

const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-muted";
const linkClass = "font-medium text-brand underline-offset-4 hover:underline";

/**
 * The QA site's control center (src/lib/qa.ts): a button in the corner of
 * every page that opens pages to jump to, the reviewer's events (with View as),
 * ready-made events, a phone-size view of this page, and Start over.
 */
export function QaControl({ events }: { events: QaEvent[] }) {
  const pathname = usePathname();
  // Open on the page it was opened on: going to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (on: boolean) => setOpenOn(on ? pathname : null);
  const [phone, setPhone] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  // Not inside the phone-size view's own frame.
  const framed = useSyncExternalStore(
    noChange,
    () => window.self !== window.top,
    () => false,
  );

  useEffect(() => {
    if (!open && !phone) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        setPhone(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phone]);

  if (framed) return null;
  return (
    <div data-qa-ui data-qa-float className="print:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="fixed bottom-4 right-4 z-40 min-h-11 rounded-full bg-violet px-4 text-sm font-semibold text-header shadow-lg ring-1 ring-header/20 hover:brightness-90"
      >
        QA tools
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qa-control-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-background shadow-xl outline-none"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-5 py-3">
              <h2 id="qa-control-title" className="text-lg font-semibold">
                QA tools
              </h2>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-8 px-5 py-5">
              <section className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    setPhone(true);
                  }}
                >
                  See this page on a phone
                </Button>
              </section>

              <EventsSection events={events} />
              <Scenarios />

              {SITE_PAGES.map((g) => (
                <section key={g.group}>
                  <h3 className={sectionTitle}>{g.group}</h3>
                  <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {g.pages.map((p) => (
                      <li key={p.href}>
                        <Link href={p.href} className={linkClass}>
                          {p.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <StartOver hasEvents={events.length > 0} />
            </div>
          </div>
        </div>
      )}

      {phone && (
        <div className="fixed inset-0 z-50 flex flex-col items-center bg-black/70 p-4" onClick={() => setPhone(false)}>
          <div ref={panel} tabIndex={-1} className="mb-3 flex items-center gap-3 outline-none" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-white">Phone size (390 wide)</p>
            <Button variant="secondary" onClick={() => setPhone(false)}>
              Close
            </Button>
          </div>
          <iframe
            title="This page at phone size"
            src={typeof window === "undefined" ? pathname : window.location.pathname + window.location.search}
            onClick={(e) => e.stopPropagation()}
            className="h-full max-h-[844px] w-[390px] max-w-full rounded-[28px] border-8 border-header bg-background"
          />
        </div>
      )}
    </div>
  );
}

/** The reviewer's own events: where to go, and View as. */
function EventsSection({ events }: { events: QaEvent[] }) {
  return (
    <section>
      <h3 className={sectionTitle}>Your test events</h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None yet. Make a ready-made one below, or use New event.</p>
      ) : (
        <ul className="mt-2 space-y-4">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg border border-border p-3">
              <p className="font-semibold">
                {e.name}
                {!e.published && <span className="ml-2 text-sm font-normal text-muted">Draft</span>}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Link href={`/dashboard/events/${e.id}`} className={linkClass}>
                  Organizer view
                </Link>
                {PUBLIC_PAGES[e.type]?.map((p) => (
                  <Link key={p.label} href={`/e/${e.slug}${p.path}`} className={linkClass}>
                    {p.label}
                  </Link>
                ))}
              </p>
              <p className="mt-3 text-sm text-muted">View as</p>
              <div className="mt-1">
                <RoleButtons eventId={e.id} personas={e.personas} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One click: a published event, dated from today, with sample people. */
function Scenarios() {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <section>
      <h3 className={sectionTitle}>Ready-made events</h3>
      <p className="mt-1 text-sm text-muted">Each one is published, dated from today, and filled with sample people.</p>
      <ul className="mt-3 space-y-2">
        {SCENARIOS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setPicked(s.id);
                setError(null);
                start(async () => {
                  const r = await createScenario(s.id);
                  if (r?.error) setError(r.error);
                });
              }}
              className="w-full rounded-lg border border-border bg-surface p-3 text-left transition hover:border-brand disabled:opacity-60"
            >
              <span className="block font-semibold">{pending && picked === s.id ? "Making it…" : s.label}</span>
              <span className="block text-sm text-muted">{s.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <FormMessage error={error} />}
    </section>
  );
}

function StartOver({ hasEvents }: { hasEvents: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!hasEvents) return null;
  return (
    <section className="border-t border-border pt-6">
      <h3 className={sectionTitle}>Start over</h3>
      <p className="mt-1 text-sm text-muted">Deletes every event in your test organization, with its sample people. Other reviewers keep theirs.</p>
      <Button
        variant="danger"
        className="mt-3"
        disabled={pending}
        onClick={async () => {
          const ok = await confirmDialog({
            title: "Delete every event in your test organization?",
            message: "This can't be undone.",
            confirmLabel: "Delete all events",
            danger: true,
          });
          if (!ok) return;
          setError(null);
          start(async () => {
            const r = await resetMyEvents();
            if (r?.error) setError(r.error);
          });
        }}
      >
        {pending ? "Deleting…" : "Delete my test events"}
      </Button>
      {error && <FormMessage error={error} />}
    </section>
  );
}
