"use client";

import Link from "next/link";
import { useRef } from "react";
import { EVENT_TYPES } from "@/lib/event-types";

/**
 * The choices, as large cards that start a new event of that kind. Kinds the
 * account's package doesn't include (and it has no pass for) are shown, but
 * can't be picked. An account with one kind skips this and goes straight there.
 */
export function EventTypeChoices({ allowed }: { allowed?: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {EVENT_TYPES.map((t) => {
        const open = !allowed || allowed.includes(t.value);
        const body = (
          <>
            <span aria-hidden className="text-3xl">
              {t.icon}
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-2 text-lg font-semibold">
              {t.label}
              {t.value === "conference" && (
                <span className="rounded-sm bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">Free</span>
              )}
              {!open && <span className="rounded-sm bg-background px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-border">Not in your plan</span>}
            </span>
            <span className="mt-1 text-sm leading-6 text-muted">{t.blurb}</span>
          </>
        );
        return (
          <li key={t.value}>
            {open ? (
              <Link
                href={`/dashboard/events/new?type=${t.value}`}
                className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-card transition hover:border-brand focus-visible:border-brand"
              >
                {body}
              </Link>
            ) : (
              <div aria-disabled className="flex h-full flex-col rounded-xl border border-dashed border-border p-5 opacity-70">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "New event": asks what kind of event first. `allowed` is what the account's
 * package (and passes) can start; with just one kind, it goes straight there.
 */
export function NewEventButton({ className, allowed }: { className?: string; allowed?: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const buttonClass =
    className ??
    "inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-hover";
  if (allowed?.length === 1) {
    return (
      <Link href={`/dashboard/events/new?type=${allowed[0]}`} className={buttonClass}>
        {allowed[0] === "conference" ? "New conference" : "New event"}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={buttonClass}
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
              <p className="mt-1 text-sm text-muted">You can change this later, until bands or groups register.</p>
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
            <EventTypeChoices allowed={allowed} />
          </div>
          {allowed && allowed.length < EVENT_TYPES.length && (
            <p className="mt-4 text-sm leading-6 text-muted">
              Planning something your plan doesn&apos;t include? Add a one-time event pass or upgrade. See what&apos;s included on your{" "}
              <Link href="/dashboard/account" className="font-medium text-brand underline-offset-4 hover:underline">
                Account
              </Link>{" "}
              page.
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
