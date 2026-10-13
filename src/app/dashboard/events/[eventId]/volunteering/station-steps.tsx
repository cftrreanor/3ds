"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/** The two steps inside each station. */
export type StationStep = "details" | "shifts";

/**
 * Step 2 of Stations & shifts, for the open station: answers typed but not
 * saved in each step, which steps are still to do, and the tab someone tried
 * to move to meanwhile (so each unfinished step can say what's left).
 */
type StationProgress = {
  dirty: Record<StationStep, boolean>;
  setDirty: (step: StationStep, dirty: boolean) => void;
  /** Steps still to do: details never saved, or no shifts yet. */
  needs: Record<StationStep, boolean>;
  leaving: string | null;
  setLeaving: (href: string | null) => void;
};
const Progress = createContext<StationProgress | null>(null);

export function UnsavedChangesProvider({
  needsDetails,
  needsShifts,
  children,
}: {
  needsDetails: boolean;
  needsShifts: boolean;
  children: ReactNode;
}) {
  const [dirty, setDirtyState] = useState<Record<StationStep, boolean>>({ details: false, shifts: false });
  const [leaving, setLeaving] = useState<string | null>(null);
  const setDirty = useCallback((step: StationStep, value: boolean) => {
    setDirtyState((d) => (d[step] === value ? d : { ...d, [step]: value }));
  }, []);
  const needs = { details: needsDetails, shifts: needsShifts };
  return <Progress.Provider value={{ dirty, setDirty, needs, leaving, setLeaving }}>{children}</Progress.Provider>;
}

/** For a step's form: report whether it has answers that aren't saved. Outside a station's steps, does nothing. */
export function useStepEdits(step: StationStep | undefined) {
  const progress = useContext(Progress);
  return useCallback((value: boolean) => {
    if (step) progress?.setDirty(step, value);
  }, [progress, step]);
}

const NOTES: Record<StationStep, { unsaved: string; todo: string }> = {
  details: {
    unsaved: "Save your changes before moving to another station.",
    todo: "Save this station's details to finish this step before moving on.",
  },
  shifts: {
    unsaved: "Create your shift before moving to another station.",
    todo: "Add at least one shift to finish this step before moving on.",
  },
};

/**
 * By a step's button: a light red note when they tried to move to another
 * station with this step unsaved or unfinished, with a way to go anyway.
 */
export function StepNotice({ step }: { step: StationStep }) {
  const progress = useContext(Progress);
  const router = useRouter();
  if (!progress?.leaving) return null;
  const unsaved = progress.dirty[step];
  if (!unsaved && !progress.needs[step]) return null;
  const href = progress.leaving;
  return (
    <div data-step-notice role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm">
      <p className="font-semibold text-danger">{unsaved ? NOTES[step].unsaved : NOTES[step].todo}</p>
      <p className="mt-0.5 text-muted">
        Or{" "}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-2"
          onClick={() => {
            progress.setLeaving(null);
            router.push(href, { scroll: false });
          }}
        >
          {progress.dirty.details || progress.dirty.shifts ? "leave without saving" : "finish it later"}
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
  const progress = useContext(Progress);
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
                if (!progress || t.active) return;
                const holdBack = (["details", "shifts"] as const).filter((s) => progress.dirty[s] || progress.needs[s]);
                if (holdBack.length === 0) return;
                // Something unsaved or unfinished: stay, open those steps and point at the first note.
                e.preventDefault();
                progress.setLeaving(t.href);
                for (const step of holdBack) {
                  const el = document.getElementById(step === "details" ? "station-details" : "build-shifts") as HTMLDetailsElement | null;
                  if (el) el.open = true;
                }
                requestAnimationFrame(() =>
                  document.querySelector("[data-step-notice]")?.scrollIntoView({ behavior: "smooth", block: "center" }),
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
