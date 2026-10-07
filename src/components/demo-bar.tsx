import { DemoSwitcher } from "@/components/demo-switcher";
import { getDemoState, PERSONAS } from "@/lib/demo";

/** Shows the demo bar while this browser is signed in as a demo person. */
export async function DemoBar() {
  const demo = await getDemoState();
  if (!demo) return null;
  return (
    <DemoSwitcher
      eventId={demo.event?.id ?? null}
      eventName={demo.event?.name ?? null}
      current={demo.persona}
      personas={PERSONAS}
    />
  );
}
