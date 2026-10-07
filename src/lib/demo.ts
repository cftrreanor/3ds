import "server-only";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo-email";
import { createAdminClient } from "@/lib/supabase/server";

// Demo mode: a FieldCommand admin tries an event as each role. Each admin has
// one demo account per role ("persona"); switching signs this browser in as
// that account. The database decides what each persona gets on the event
// (supabase/migrations/20261026000000_demo_mode.sql).

export const PERSONAS = [
  { value: "host", label: "Host" },
  { value: "volunteer_lead", label: "Volunteer Lead" },
  { value: "section_lead", label: "Section Lead" },
  { value: "director", label: "Director" },
  { value: "volunteer", label: "Volunteer" },
  { value: "parent", label: "Parent" },
] as const;
export type Persona = (typeof PERSONAS)[number]["value"];

export const personaLabel = (p: Persona) => PERSONAS.find((x) => x.value === p)!.label;

/** e.g. section-lead-1f0c…@demo.fieldcommandevents.com (one per admin and role). */
export const demoEmail = (ownerId: string, persona: Persona) =>
  `${persona.replace("_", "-")}-${ownerId.replace(/-/g, "")}@${DEMO_EMAIL_DOMAIN}`;

/** Set while this browser is in demo mode, so pages only look up demo details then. */
export const DEMO_COOKIE = "fc_demo";

export type DemoState = {
  ownerId: string;
  persona: Persona;
  event: { id: string; name: string; slug: string } | null;
};

/** The demo account this browser is signed in as (and the event being demoed), or null. */
export async function getDemoState(): Promise<DemoState | null> {
  if (!(await cookies()).has(DEMO_COOKIE)) return null;
  const user = await getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: acct } = await admin.from("demo_accounts").select("owner_id, persona").eq("user_id", user.id).maybeSingle();
  if (!acct) return null;
  const { data: latest } = await admin
    .from("demo_events")
    .select("events(id, name, slug)")
    .eq("owner_id", acct.owner_id)
    .order("last_used_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const event = (latest?.events ?? null) as unknown as DemoState["event"];
  return { ownerId: acct.owner_id, persona: acct.persona as Persona, event };
}
