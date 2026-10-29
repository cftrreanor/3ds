"use client";

import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/ui";
import { FORM_FAILED, FORM_SAVED } from "../../_components/setup-leave";

/*
 * A tab's editor is a form, so switching tabs with unsaved changes asks first
 * (SetupTabs): typing marks it changed, `markChanged` does the same for a
 * button (a move, a skip), and `markSaved` tells whoever's waiting how the
 * save went.
 */
export const markChanged = (form: RefObject<HTMLFormElement | null>) =>
  form.current?.dispatchEvent(new Event("change", { bubbles: true }));
export const markSaved = (form: RefObject<HTMLFormElement | null>, ok: boolean) =>
  form.current?.dispatchEvent(new Event(ok ? FORM_SAVED : FORM_FAILED, { bubbles: true }));

/** The Save bar pinned to the bottom of the screen until the editor ends, saying whether anything's unsaved. */
export function SaveFooter({
  dirty,
  saved,
  pending,
  label,
  inCard = true,
  children,
}: {
  dirty: boolean;
  saved: boolean;
  pending: boolean;
  label: string;
  /** Flush along the bottom of the card it's in, or a bar of its own under a list of cards. */
  inCard?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`sticky bottom-[var(--day-bar,0px)] z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-border bg-surface px-4 py-3 shadow-[0_-6px_16px_rgb(0_0_0/0.10)] ${
        inCard ? "-mx-4 -mb-4 rounded-b-lg border-t-2 sm:-mx-6 sm:-mb-6 sm:px-6" : "rounded-lg border-2"
      }`}
    >
      <p className="flex min-w-0 flex-1 items-center gap-2 text-sm" aria-live="polite">
        {dirty || !saved ? (
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[#f5b301] ring-1 ring-warning/50" />
        ) : (
          <span aria-hidden className="font-bold text-success">
            ✓
          </span>
        )}
        <span className="font-semibold">{dirty ? "Unsaved changes" : saved ? "All changes saved" : "Not saved yet"}</span>
      </p>
      {children}
      <Button type="submit" disabled={pending || (saved && !dirty)} aria-busy={pending}>
        {pending ? "Saving…" : label}
      </Button>
    </div>
  );
}
