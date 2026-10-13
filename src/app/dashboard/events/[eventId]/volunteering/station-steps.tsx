"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Step 2 of Stations & shifts: which station's details have changes that
 * aren't saved yet, and the tab someone tried to move to meanwhile.
 */
type UnsavedState = {
  dirty: string | null;
  setDirty: (station: string | null) => void;
  /** The other station's tab they clicked, while held back to save first. */
  leaving: string | null;
  setLeaving: (href: string | null) => void;
};
const Unsaved = createContext<UnsavedState>({ dirty: null, setDirty: () => {}, leaving: null, setLeaving: () => {} });

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirtyState] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const setDirty = useCallback((station: string | null) => {
    setDirtyState(station);
    if (!station) setLeaving(null);
  }, []);
  return <Unsaved.Provider value={{ dirty, setDirty, leaving, setLeaving }}>{children}</Unsaved.Provider>;
}

/** For a form inside the provider: report unsaved changes (or none). Outside it, does nothing. */
export const useUnsavedChanges = () => useContext(Unsaved).setDirty;

/**
 * Beside a station's Save button: a light red note when they tried to move
 * to another station without saving, with a way to leave anyway.
 */
export function UnsavedNotice() {
  const { dirty, leaving, setDirty } = useContext(Unsaved);
  const router = useRouter();
  if (!dirty || !leaving) return null;
  return (
    <div id="unsaved-notice" role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm">
      <p className="font-semibold text-danger">Save your changes before moving to another station.</p>
      <p className="mt-0.5 text-muted">
        Or{" "}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-2"
          onClick={() => {
            setDirty(null);
            router.push(leaving, { scroll: false });
          }}
        >
          leave without saving
        </button>
        .
      </p>
    </div>
  );
}

export type StationTab = {
  id: string;
  name: string;
  href: string;
  active: boolean;
  /** Details saved and at least one shift. */
  configured: boolean;
  filled: number;
  capacity: number;
};

/** The stations as tabs: a green check when one is set up, a yellow dot when it isn't yet. */
export function StationTabs({ tabs }: { tabs: StationTab[] }) {
  const { dirty, setLeaving } = useContext(Unsaved);
  return (
    <nav aria-label="Stations" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((t) => (
          <li key={t.id}>
            <Link
              href={t.href}
              scroll={false}
              aria-current={t.active ? "page" : undefined}
              onClick={(e) => {
                if (!dirty || t.active) return;
                // Unsaved details: stay, and point at the note by the Save button.
                e.preventDefault();
                setLeaving(t.href);
                const details = document.getElementById("station-details") as HTMLDetailsElement | null;
                if (details) details.open = true;
                requestAnimationFrame(() =>
                  document.getElementById("unsaved-notice")?.scrollIntoView({ behavior: "smooth", block: "center" }),
                );
              }}
              className={`-mb-px flex flex-col border-b-2 px-4 py-2 text-sm ${
                t.active ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {t.configured ? (
                  <span aria-hidden className="font-bold text-success">
                    ✓
                  </span>
                ) : (
                  <span aria-hidden className="size-2.5 rounded-full bg-[#f5b301] ring-1 ring-warning/50" />
                )}
                {t.name}
                <span className="sr-only">{t.configured ? " (set up)" : " (not set up yet)"}</span>
              </span>
              <span className="text-xs font-normal tabular-nums text-muted">
                {t.capacity ? `${t.filled}/${t.capacity} filled` : "No shifts"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Beside an accordion's title: done, or still to do. */
export function StepStatus({ done }: { done: boolean }) {
  return done ? (
    <span className="flex items-center gap-1 text-sm font-semibold text-success">
      <span aria-hidden>✓</span> Done
    </span>
  ) : (
    <span className="text-sm text-muted italic">Needs to be done</span>
  );
}
