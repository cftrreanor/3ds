"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { EVENT_TYPES } from "@/lib/event-types";
import type { TypeNote } from "@/lib/plan";

type TypeChoice = (typeof EVENT_TYPES)[number];

/** How the kinds are grouped (pickerGroups in src/lib/plan.ts). */
export type PickerGroups = { label?: string; ended?: string };

/**
 * The choices, as large cards that start a new event of that kind.
 * - With an active plan, the kinds it includes come first under `groups.label`.
 *   Every other kind sits in a folded section, to try: it can be set up and
 *   previewed, and publishing it needs a plan that includes it.
 * - After a plan ends (`groups.ended`), the kind it can still publish (`lead`)
 *   comes first, and every other kind is in one list: set up now, publish with a plan.
 * `notes` adds a line to a card (typeNotes).
 */
export function EventTypeChoices({
  included,
  notes = {},
  lead,
  groups = {},
}: {
  included?: string[];
  notes?: Record<string, TypeNote>;
  lead?: string;
  groups?: PickerGroups;
}) {
  if (groups.ended) {
    const now = EVENT_TYPES.filter((t) => t.value === lead);
    const later = EVENT_TYPES.filter((t) => t.value !== lead);
    return (
      <div className="space-y-6">
        <p className="text-sm leading-6">{groups.ended}</p>
        {now.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">You can publish</h3>
            <TypeCards types={now} notes={notes} />
          </section>
        )}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Set up now, publish with a plan</h3>
          <TypeCards types={later} notes={{}} />
        </section>
      </div>
    );
  }
  const main = included ? EVENT_TYPES.filter((t) => included.includes(t.value)) : EVENT_TYPES;
  const more = included ? EVENT_TYPES.filter((t) => !included.includes(t.value)) : [];
  return (
    <div>
      {groups.label && <h3 className="mb-3 text-sm font-semibold">{groups.label}</h3>}
      <TypeCards types={main} notes={notes} />
      {more.length > 0 && (
        <details
          className="group mt-6 scroll-mt-28 rounded-xl border border-border"
          onToggle={(e) => {
            // On a small screen the new cards open below the fold: bring the section into view.
            const el = e.currentTarget;
            if (el.open && window.innerHeight < 900) el.scrollIntoView({ block: "start", behavior: "smooth" });
          }}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
            {more.length} more {more.length === 1 ? "kind" : "kinds"} of event to try
            <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0 text-brand transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="px-4 pb-4">
            <p className="mb-4 text-sm leading-6">Set up and preview any of these. To publish one, you need a plan that includes it.</p>
            <TypeCards types={more} notes={notes} trial />
          </div>
        </details>
      )}
    </div>
  );
}

const NOTE_TONE: Record<TypeNote["tone"], string> = { info: "text-foreground", warn: "font-medium text-warning", ok: "font-medium text-success" };

function TypeCards({ types, notes, trial }: { types: readonly TypeChoice[]; notes: Record<string, TypeNote>; trial?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {types.map((t) => {
        const note = notes[t.value];
        return (
          <li key={t.value}>
            <Link
              href={`/dashboard/events/new?type=${t.value}`}
              className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-card transition hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-5"
            >
              <span className="flex items-center justify-between gap-3">
                <span aria-hidden className="text-2xl sm:text-3xl">
                  {t.icon}
                </span>
                {trial && <span className="text-xs font-semibold text-muted">Not in your plan</span>}
              </span>
              <span className="mt-2 text-lg font-semibold sm:mt-3">{t.label}</span>
              {note && (
                <span className={`mt-1 flex items-start gap-1.5 text-sm leading-6 ${NOTE_TONE[note.tone]}`}>
                  {note.tone === "warn" && <LockIcon />}
                  {note.text}
                </span>
              )}
              <span className="mt-1 text-sm leading-6 text-muted">{t.blurb}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function LockIcon({ className = "mt-1 size-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * "New event": asks what kind of event first (see EventTypeChoices).
 */
export function NewEventButton({
  className,
  included,
  notes,
  lead,
  groups,
}: {
  className?: string;
  included?: string[];
  notes?: Record<string, TypeNote>;
  /** The kind to show first (the one an account can still publish after its plan ends). */
  lead?: string;
  groups?: PickerGroups;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The page can have two New event buttons (header and empty state): each dialog's title needs its own id.
  const titleId = useId();
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
        aria-labelledby={titleId}
        // Pinned near the top, so it grows downward when a section opens instead of jumping.
        className="mx-auto mb-auto mt-[5vh] max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-border bg-background p-0 text-foreground shadow-elevated backdrop:bg-[#0d1422]/75"
        onClick={(e) => {
          // A click on the backdrop closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          {/* The question and close button stay in view while the cards scroll. */}
          <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-4 border-b border-border bg-background px-5 pb-3 pt-5 sm:-mx-6 sm:px-6 sm:pt-6">
            <h2 id={titleId} className="text-2xl font-semibold">
              What kind of event is this?
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-2xl text-muted hover:text-foreground"
            >
              ×
            </button>
          </div>
          <div className="mt-5">
            <EventTypeChoices included={included} notes={notes} lead={lead} groups={groups} />
          </div>
        </div>
      </dialog>
    </>
  );
}
