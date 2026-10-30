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
  showing: number;
  hidden: number;
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
  const counts =
    facts.showing + facts.hidden > 0
      ? [facts.showing ? `${facts.showing} showing` : null, facts.hidden ? `${facts.hidden} hidden` : null].filter(Boolean).join(", ")
      : null;
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
          const note = now ? "Now" : done[i] ? "Done" : i === 1 && facts.jobsNote ? facts.jobsNote : i === 2 ? "Last" : "Next";
          return (
            <li key={s.key} className="min-w-0">
              <span
                aria-hidden
                className={`block h-1.5 rounded-full ${done[i] && !now ? "bg-success" : now ? "bg-brand" : "border border-field-border bg-surface"}`}
              />
              {now ? (
                <span aria-current="step" className="mt-2 block text-sm font-semibold">
                  {s.label}
                </span>
              ) : (
                <Link href={`${base}${s.path}`} className="mt-2 inline-flex min-h-6 text-sm font-semibold underline underline-offset-4 hover:text-brand">
                  {s.label}
                </Link>
              )}
              <span className={`block text-xs leading-5 ${done[i] && !now ? "text-success" : "text-muted"}`}>
                {done[i] && !now && <span aria-hidden>✓ </span>}
                {note}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
