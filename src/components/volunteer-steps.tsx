"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The volunteer event steps, and where each one lives under the event. */
const STEPS = [
  { key: "details", label: "Details", path: "/edit" },
  { key: "jobs", label: "Jobs and shifts", path: "/volunteering" },
  { key: "publish", label: "Publish", path: "" },
] as const;

/** The pages that show the steps (every other page keeps the setup strip). */
export const VOLUNTEER_STEP_PATHS = STEPS.map((s) => s.path);

export type VolunteerStepFacts = {
  /** Volunteers can see a job with a shift or a thing to bring. */
  jobsDone: boolean;
  /** What the jobs step still needs, when it isn't done ("2 jobs are hidden…"). */
  jobsNote: string | null;
  jobs: number;
};

/**
 * A volunteer event before it's published: three steps along the top of
 * Details, Jobs and shifts, and the event page (Publish), each a link, with
 * the one you're on marked "Now".
 */
export function VolunteerSteps({ eventId, facts }: { eventId: string; facts: VolunteerStepFacts }) {
  const pathname = usePathname();
  const base = `/dashboard/events/${eventId}`;
  const here = STEPS.findIndex((s) => pathname === `${base}${s.path}`);
  if (here < 0) return null;
  const done = [true, facts.jobsDone, false];
  const counts = facts.jobs ? `${facts.jobs} ${facts.jobs === 1 ? "job" : "jobs"}` : null;
  const doneCount = done.filter(Boolean).length;
  return (
    <nav aria-label="Volunteer event setup" className="mb-6 print:hidden">
      <p className="text-sm">
        <span className="font-semibold">
          Step {here + 1} of 3:
        </span>{" "}
        {STEPS[here].label}
        {here === 1 && counts && <span className="text-muted"> · {counts}</span>}
        <span className="sr-only">. {doneCount} of 3 done.</span>
      </p>
      <ol className="mt-2 grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => {
          const now = i === here;
          // The jobs step, when a job still needs something: amber, saying what (like the tabs' ◆ lines).
          const needs = i === 1 && !done[i] && Boolean(facts.jobsNote);
          const note = done[i] && !now ? "Done" : needs ? facts.jobsNote : now ? "Now" : "Not yet";
          return (
            <li key={s.key} className="min-w-0">
              <span
                aria-hidden
                className={`block rounded-full ${now ? "h-2 bg-brand" : done[i] ? "h-1.5 bg-success" : needs ? "h-1.5 bg-warning" : "h-1.5 border border-field-border bg-surface"}`}
              />
              {now ? (
                <span aria-current="step" className="mt-2 block text-sm font-semibold">
                  {s.label}
                </span>
              ) : (
                <Link href={`${base}${s.path}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 hover:text-brand">
                  {s.label}
                </Link>
              )}
              <span className={`block text-xs leading-5 ${done[i] && !now ? "text-success" : needs ? "font-medium text-warning" : "text-muted"}`}>
                {done[i] && !now && <span aria-hidden>✓ </span>}
                {needs && <span aria-hidden>◆ </span>}
                {note}
              </span>
            </li>
          );
        })}
      </ol>
      {/* Details (step 1) has no bar of its own: the way on to step 2. */}
      {here === 0 && (
        <p className="mt-1 text-right">
          <Link href={`${base}${STEPS[1].path}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4">
            Next up: Jobs and shifts →
          </Link>
        </p>
      )}
    </nav>
  );
}
