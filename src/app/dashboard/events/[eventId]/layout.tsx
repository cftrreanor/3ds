import { DayBar } from "@/components/event-day-nav";
import { SetupStrip } from "@/components/setup-guide";
import { loadDayActions } from "@/lib/event-day-actions";
import { loadSetupFacts } from "@/lib/setup-facts";
import { setupChecklist } from "@/lib/setup-checklist";

/**
 * Every page of an event. On the day itself, the team's jobs of the day are a
 * tap away on every page; other days, hosts see where setup stands and the
 * next step (the strip hides itself where it isn't wanted).
 */
export default async function EventLayout({ children, params }: LayoutProps<"/dashboard/events/[eventId]">) {
  const { eventId } = await params;
  const day = await loadDayActions(eventId);
  const facts = day ? null : await loadSetupFacts(eventId);
  return (
    <>
      {day && <DayBar day={day} />}
      {facts && <SetupStrip eventId={eventId} initial={setupChecklist(facts)} />}
      {children}
      {/* Room for the tab bar along the bottom of a phone. */}
      {day && <div aria-hidden className="h-16 lg:hidden" />}
    </>
  );
}
