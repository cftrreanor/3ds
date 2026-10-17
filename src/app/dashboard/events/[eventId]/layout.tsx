import { SetupStrip } from "@/components/setup-guide";
import { loadSetupFacts } from "@/lib/setup-facts";
import { setupChecklist } from "@/lib/setup-checklist";

/** Every page of an event: hosts see where setup stands and the next step (the strip hides itself where it isn't wanted). */
export default async function EventLayout({ children, params }: LayoutProps<"/dashboard/events/[eventId]">) {
  const { eventId } = await params;
  const facts = await loadSetupFacts(eventId);
  return (
    <>
      {facts && <SetupStrip eventId={eventId} initial={setupChecklist(facts)} />}
      {children}
    </>
  );
}
