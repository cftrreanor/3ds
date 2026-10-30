import { DayBar } from "@/components/event-day-nav";
import { SetupStrip } from "@/components/setup-guide";
import { loadDayActions } from "@/lib/event-day-actions";
import { loadSetupFacts } from "@/lib/setup-facts";
import { emptyJobsNote, setupChecklist, type SetupFacts } from "@/lib/setup-checklist";
import { VOLUNTEER_STEP_PATHS, VolunteerSteps, type VolunteerStepFacts } from "@/components/volunteer-steps";

/**
 * Every page of an event. On the day itself, the team's jobs of the day are a
 * tap away on every page; other days, hosts see where setup stands and the
 * next step (the strip hides itself where it isn't wanted).
 */
export default async function EventLayout({ children, params }: LayoutProps<"/dashboard/events/[eventId]">) {
  const { eventId } = await params;
  const day = await loadDayActions(eventId);
  const facts = day ? null : await loadSetupFacts(eventId);
  // A volunteer event being set up: Details, Jobs and shifts, and Publish as three steps along the top of those pages.
  const steps = facts && facts.eventType === "volunteer" && !facts.published ? volunteerSteps(facts) : null;
  return (
    <>
      {day && <DayBar day={day} />}
      {steps && <VolunteerSteps eventId={eventId} facts={steps} />}
      {facts && <SetupStrip eventId={eventId} initial={setupChecklist(facts)} skip={steps ? VOLUNTEER_STEP_PATHS : undefined} />}
      {children}
      {/* Room for the tab bar along the bottom of a phone. */}
      {day && <div aria-hidden className="h-16 lg:hidden print:hidden" />}
    </>
  );
}

function volunteerSteps(f: SetupFacts): VolunteerStepFacts {
  const empty = f.emptyJobs ?? [];
  const jobsDone = (f.readyJobs ?? 0) > 0 && empty.length === 0;
  return { jobsDone, jobsNote: jobsDone ? null : f.stations === 0 ? "Add a job" : emptyJobsNote(empty), jobs: f.stations };
}
