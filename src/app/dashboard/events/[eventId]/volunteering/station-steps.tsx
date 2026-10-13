"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

/**
 * Step 2 of Stations & shifts: which station's details have changes that
 * aren't saved yet, so moving to another station's tab can warn first.
 */
const Unsaved = createContext<{ dirty: string | null; setDirty: (station: string | null) => void }>({
  dirty: null,
  setDirty: () => {},
});

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState<string | null>(null);
  return <Unsaved.Provider value={{ dirty, setDirty }}>{children}</Unsaved.Provider>;
}

/** For a form inside the provider: report unsaved changes (or none). Outside it, does nothing. */
export const useUnsavedChanges = () => useContext(Unsaved).setDirty;

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
  const { dirty, setDirty } = useContext(Unsaved);
  const router = useRouter();
  const [leaving, setLeaving] = useState<string | null>(null);

  return (
    <div>
      {leaving && dirty && (
        <div role="alert" className="mb-4 rounded-md border border-danger bg-danger px-4 py-3 text-danger-foreground">
          <p className="font-semibold">Save the {dirty} station details before moving on.</p>
          <p className="mt-1 text-sm">You changed them but haven&apos;t saved yet. Leaving now loses those changes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="text-foreground"
              onClick={() => {
                setLeaving(null);
                document.getElementById("station-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Go back and save
            </Button>
            <button
              type="button"
              className="min-h-11 px-3 text-sm font-semibold underline underline-offset-2"
              onClick={() => {
                const href = leaving;
                setLeaving(null);
                setDirty(null);
                router.push(href, { scroll: false });
              }}
            >
              Leave without saving
            </button>
          </div>
        </div>
      )}
      <nav aria-label="Stations" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-border">
          {tabs.map((t) => (
            <li key={t.id}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={t.active ? "page" : undefined}
                onClick={(e) => {
                  if (dirty && !t.active) {
                    e.preventDefault();
                    setLeaving(t.href);
                  }
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
    </div>
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
