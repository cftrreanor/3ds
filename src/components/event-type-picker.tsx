"use client";

import Link from "next/link";
import { useRef } from "react";
import { Badge } from "@/components/ui";
import { EVENT_TYPES } from "@/lib/event-types";
import type { TypeNote } from "@/lib/plan";

type TypeChoice = (typeof EVENT_TYPES)[number];

/**
 * The choices, as large cards that start a new event of that kind. The kinds
 * the account's plan includes (`included`) come first, with `lead` (the one it
 * can still publish after a plan ends) at the top. Every other kind sits in a
 * folded section, to try: it can be set up and previewed, and publishing it
 * needs a plan that includes it. `notes` adds a line to a card (typeNotes).
 */
export function EventTypeChoices({ included, notes = {}, lead }: { included?: string[]; notes?: Record<string, TypeNote>; lead?: string }) {
  const main = (included ? EVENT_TYPES.filter((t) => included.includes(t.value)) : [...EVENT_TYPES]).sort(
    (a, b) => Number(b.value === lead) - Number(a.value === lead),
  );
  const more = included ? EVENT_TYPES.filter((t) => !included.includes(t.value)) : [];
  return (
    <div>
      <TypeCards types={main} notes={notes} />
      {more.length > 0 && (
        <details className="group mt-6 rounded-xl border border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
            {more.length} more {more.length === 1 ? "kind" : "kinds"} of event to try
            <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0 text-brand transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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

const NOTE_TONE: Record<TypeNote["tone"], string> = { info: "text-foreground", warn: "text-warning", ok: "text-success" };

function TypeCards({ types, notes, trial }: { types: readonly TypeChoice[]; notes: Record<string, TypeNote>; trial?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {types.map((t) => {
        const note = notes[t.value];
        return (
          // An odd last card spans both columns, so the grid has no hole.
          <li key={t.value} className="sm:[&:last-child:nth-child(odd)]:col-span-2">
            <Link
              href={`/dashboard/events/new?type=${t.value}`}
              className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-card transition hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-5"
            >
              <span className="flex items-center justify-between gap-3">
                <span aria-hidden className="text-2xl sm:text-3xl">
                  {t.icon}
                </span>
                {trial && <Badge tone="info">Try it</Badge>}
              </span>
              <span className="mt-2 text-lg font-semibold sm:mt-3">{t.label}</span>
              {note && (
                <span className={`mt-1 flex items-start gap-1.5 text-sm font-medium leading-6 ${NOTE_TONE[note.tone]}`}>
                  {note.tone === "warn" && <LockIcon />}
                  {note.text}
                </span>
              )}
              <span className="mt-1 line-clamp-2 text-sm leading-6 text-muted sm:line-clamp-none">{t.blurb}</span>
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
 * "New event": asks what kind of event first, with the plan's own kinds up
 * top and the rest to try (see EventTypeChoices).
 */
export function NewEventButton({
  className,
  included,
  notes,
  subtitle,
  lead,
}: {
  className?: string;
  included?: string[];
  notes?: Record<string, TypeNote>;
  /** The kind to show first (the one an account can still publish after its plan ends). */
  lead?: string;
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
        className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-border bg-background p-0 text-foreground shadow-elevated backdrop:bg-[#0d1422]/75"
        onClick={(e) => {
          // A click on the backdrop closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          {/* The heading and close button stay in view while the cards scroll. */}
          <div className="sticky top-0 z-10 -mx-5 flex items-start justify-between gap-4 border-b border-border bg-background px-5 pb-3 pt-5 sm:-mx-6 sm:px-6 sm:pt-6">
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
            <EventTypeChoices included={included} notes={notes} lead={lead} />
          </div>
        </div>
      </dialog>
    </>
  );
}
