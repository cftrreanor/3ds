import "server-only";
import { demoEmail, personaLabel, type Persona } from "@/lib/demo";
import type { createAdminClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

/** The admin's demo account for a role, created the first time. */
export async function demoAccount(admin: Admin, ownerId: string, persona: Persona): Promise<{ id: string; email: string } | null> {
  const { data: existing } = await admin
    .from("demo_accounts")
    .select("user_id, profiles!demo_accounts_user_id_fkey(email)")
    .eq("owner_id", ownerId)
    .eq("persona", persona)
    .maybeSingle();
  if (existing) {
    const email = (existing.profiles as unknown as { email: string } | null)?.email;
    return email ? { id: existing.user_id, email } : null;
  }

  const email = demoEmail(ownerId, persona);
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: `Demo ${personaLabel(persona)}` },
  });
  let id = created.data.user?.id;
  if (!id) {
    // Made before but not recorded (e.g. an interrupted first try).
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    id = profile?.id;
  }
  if (!id) {
    console.error("Creating demo account failed", created.error);
    return null;
  }
  const { error } = await admin.from("demo_accounts").upsert({ user_id: id, owner_id: ownerId, persona });
  if (error) {
    console.error("Recording demo account failed", error);
    return null;
  }
  return { id, email };
}
