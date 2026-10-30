"use client";

import Link from "next/link";
import { useRef } from "react";
import { Badge } from "@/components/ui";
import { EVENT_TYPES } from "@/lib/event-types";

type TypeChoice = (typeof EVENT_TYPES)[number];

/**
 * The choices, as large cards that start a new event of that kind. The kinds
 * the account's plan includes (`included`) come first. Every other kind sits in
 * a folded "Interested in more?" section, to try: it can be set up and
 * previewed, and publishing it needs a plan that includes it. `notes` adds a
 * line to a card, such as "Publishing needs a plan" after a plan ends.
 */
export function EventTypeChoices({ included, notes = {} }: { included?: string[]; notes?: Record<string, string> }) {
  const main = included ? EVENT_TYPES.filter((t) => included.includes(t.value)) : EVENT_TYPES;
  const more = included ? EVENT_TYPES.filter((t) => !included.includes(t.value)) : [];
  return (
    <div>
      <TypeCards types={main} notes={notes} />
      {more.length > 0 && (
        <details className="group mt-6 rounded-xl border border-border">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
            <span aria-hidden className="transition group-open:rotate-90">
              ›
            </span>
            Interested in more? {more.length} more {more.length === 1 ? "kind" : "kinds"} of event to try
          </summary>
          <div className="px-4 pb-4">
            <p className="mb-4 text-sm leading-6">Try any of these: set it up and preview it. Publishing needs a plan that includes it.</p>
            <TypeCards types={more} notes={notes} trial />
          </div>
        </details>
      )}
    </div>
  );
}

function TypeCards({ types, notes, trial }: { types: readonly TypeChoice[]; notes: Record<string, string>; trial?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {types.map((t) => (
        <li key={t.value}>
          <Link
            href={`/dashboard/events/new?type=${t.value}`}
            className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-card transition hover:border-brand focus-visible:border-brand"
          >
            <span aria-hidden className="text-3xl">
              {t.icon}
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-2 text-lg font-semibold">
              {t.label}
              {trial && <Badge tone="neutral">Try it</Badge>}
            </span>
            {notes[t.value] && <span className="mt-2 text-sm font-medium leading-6">{notes[t.value]}</span>}
            <span className="mt-1 text-sm leading-6 text-muted">{t.blurb}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * "New event": asks what kind of event first, with the plan's own kinds up
 * top and the rest to try (see EventTypeChoices).
 */
export function NewEventButton({
  className,
  included,
  notes,
  subtitle,
}: {
  className?: string;
  included?: string[];
  notes?: Record<string, string>;
  /** Under the heading, e.g. "Your … plan includes these" (pickerSubtitle). */
  subtitle?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const buttonClass =
    className ??
    "inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-hover";
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={buttonClass}>
        New event
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="new-event-title"
        className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-border bg-background p-0 text-foreground shadow-elevated backdrop:bg-[#0d1422]/60"
        onClick={(e) => {
          // A click on the backdrop closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="new-event-title" className="text-2xl font-semibold">
                What kind of event is this?
              </h2>
              {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
              className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-2xl text-muted hover:text-foreground"
            >
              ×
            </button>
          </div>
          <div className="mt-5">
            <EventTypeChoices included={included} notes={notes} />
          </div>
        </div>
      </dialog>
    </>
  );
}
