"use server";

import { loadSetupFacts } from "@/lib/setup-facts";
import { setupChecklist, type SetupChecklist } from "@/lib/setup-checklist";

/** The setup checklist as it stands now (hosts only; null for anyone else). */
export async function currentChecklist(eventId: string): Promise<SetupChecklist | null> {
  const facts = await loadSetupFacts(eventId);
  return facts ? setupChecklist(facts) : null;
}
