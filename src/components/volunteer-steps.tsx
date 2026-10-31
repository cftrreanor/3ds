"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETUP_STEPS as STEPS, type SetupStepFacts, type StepsKind } from "@/lib/setup-steps";

/**
 * An event before it's published: three steps along the top of Details, its middle step (Jobs
 * and shifts, or Registration), and the event page (Publish), each a link, with the one you're
 * on marked "Now". Status is said in words at every width, not by color alone.
 */
export function SetupSteps({ eventId, kind, facts }: { eventId: string; kind: StepsKind; facts: SetupStepFacts }) {
  const pathname = usePathname();
  const base = `/dashboard/events/${eventId}`;
  const steps = STEPS[kind];
  const here = steps.findIndex((s) => pathname === `${base}${s.path}`);
  if (here < 0) return null;
  const done = [true, facts.middleDone, false];
  const doneCount = done.filter(Boolean).length;
  return (
    <nav aria-label="Event setup" className="mb-6 print:hidden">
      <p className="text-sm">
        <span className="font-semibold">Step {here + 1} of 3:</span> {steps[here].label}
        {here === 1 && facts.count && <span className="text-muted"> · {facts.count}</span>}
        <span className="sr-only">. {doneCount} of 3 done.</span>
      </p>
      <ol className="mt-2 grid grid-cols-3 gap-2">
        {steps.map((s, i) => {
          const now = i === here;
          // The middle step, when it still needs something: amber, saying what.
          const needs = i === 1 && !done[i] && Boolean(facts.middleNote);
          const note = done[i] && !now ? "Done" : needs ? facts.middleNote : now ? "Now" : "Not yet";
          return (
            <li key={s.key} className="min-w-0">
              <span
                aria-hidden
                className={`block rounded-full ${now ? "h-2 bg-brand" : done[i] ? "h-1.5 bg-success" : needs ? "h-1.5 bg-warning" : "h-1.5 border border-field-border bg-surface"}`}
              />
              {now ? (
                <span aria-current="step" className="mt-1 flex min-h-11 items-center text-sm font-semibold">
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
          <Link href={`${base}${steps[1].path}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4">
            Next up: {steps[1].label} →
          </Link>
        </p>
      )}
    </nav>
  );
}
