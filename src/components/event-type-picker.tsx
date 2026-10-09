"use client";

import Link from "next/link";
import { useRef } from "react";
import { EVENT_TYPES } from "@/lib/event-types";

/** The choices, as large cards that start a new event of that kind. */
export function EventTypeChoices() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {EVENT_TYPES.map((t) => (
        <li key={t.value}>
          <Link
            href={`/dashboard/events/new?type=${t.value}`}
            className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-card transition hover:border-brand focus-visible:border-brand"
          >
            <span aria-hidden className="text-3xl">
              {t.icon}
            </span>
            <span className="mt-3 text-lg font-semibold">{t.label}</span>
            <span className="mt-1 text-sm leading-6 text-muted">{t.blurb}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "New event": asks what kind of event first. */
export function NewEventButton({ className }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={
          className ??
          "inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-hover"
        }
      >
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
              <p className="mt-1 text-sm text-muted">You can change this later, as long as no one has registered yet.</p>
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
            <EventTypeChoices />
          </div>
        </div>
      </dialog>
    </>
  );
}
