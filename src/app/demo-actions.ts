"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { isSchemaError } from "@/lib/schema-check";
import { requireUser } from "@/lib/auth";
import { getOrigin } from "@/lib/data";
import { DEMO_COOKIE, demoEmail, PERSONAS, personaLabel, type Persona } from "@/lib/demo";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

const isPersona = (p: string): p is Persona => PERSONAS.some((x) => x.value === p);

const NEEDS_UPDATE =
  "Demo mode needs a database update: run 20261026000000_demo_mode.sql in the Supabase SQL Editor (see docs/SETUP-GUIDE.md), then try again.";

/**
 * Switch this browser to a demo role on an event. A FieldCommand admin can
 * start from their own account (which turns demo mode on for the event); a
 * demo account can switch to its admin's other demo accounts, on events that
 * admin turned demo mode on for.
 */
export async function switchDemo(eventId: string, persona: string): Promise<ActionState> {
  if (!isPersona(persona)) return { error: "Pick a role to view as." };
  const user = await requireUser();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: mine } = await admin.from("demo_accounts").select("owner_id").eq("user_id", user.id).maybeSingle();
  let ownerId: string;
  if (mine) {
    ownerId = mine.owner_id;
    const { data: stillAdmin } = await admin.from("platform_admins").select("user_id").eq("user_id", ownerId).maybeSingle();
    if (!stillAdmin) return { error: "Demo mode is only for FieldCommand admins." };
    const { data: on } = await admin
      .from("demo_events")
      .select("event_id")
      .eq("owner_id", ownerId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!on) return { error: "Demo mode is off for this event. Go back to your own account to turn it on." };
  } else {
    if (!(await supabase.rpc("is_platform_admin")).data) return { error: "Only FieldCommand admins can use demo mode." };
    ownerId = user.id;
    const { error } = await admin
      .from("demo_events")
      .upsert({ owner_id: ownerId, event_id: eventId, last_used_at: new Date().toISOString() });
    if (error) {
      console.error("Turning on demo mode failed", error);
      return { error: isSchemaError(error) ? NEEDS_UPDATE : `We couldn't turn on demo mode for this event. (Details: ${error.code ?? "unknown"}: ${error.message})` };
    }
  }

  const person = await demoAccount(admin, ownerId, persona);
  if (!person) return { error: "We couldn't set up the demo person. Please try again." };
  const { data: bandId, error: joinError } = await admin.rpc("demo_join", {
    p_owner: ownerId,
    p_event: eventId,
    p_user: person.id,
  });
  if (joinError) {
    console.error("demo_join failed", joinError);
    return {
      error: isSchemaError(joinError)
        ? NEEDS_UPDATE
        : joinError.message === "Add a classification to the event first"
          ? "Add at least one classification to the event first (Edit details), so the demo band can register."
          : "We couldn't add the demo person to this event. Please try again.",
    };
  }
  const { data: event } = await admin.from("events").select("slug").eq("id", eventId).single();

  // Sign this browser in as the demo person (no email is sent).
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: person.email });
  if (link.error) {
    console.error("Demo sign-in link failed", link.error);
    return { error: "We couldn't switch to the demo person. Please try again." };
  }
  await supabase.auth.signOut({ scope: "local" });
  const { error: signInError } = await supabase.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "email" });
  if (signInError) {
    console.error("Demo sign-in failed", signInError);
    redirect("/login");
  }
  (await cookies()).set(DEMO_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 7 });

  revalidatePath("/", "layout");
  redirect(
    persona === "parent"
      ? `/e/${event?.slug}`
      : persona === "volunteer"
        ? "/my"
        : persona === "director" && bandId
          ? `/dashboard/bands/${bandId}`
          : `/dashboard/events/${eventId}`,
  );
}

/** The admin's demo account for a role, created the first time. */
async function demoAccount(admin: Admin, ownerId: string, persona: Persona): Promise<{ id: string; email: string } | null> {
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

/** Leave demo mode: sign out and email a sign-in link to the admin's own address. */
export async function backToMe(): Promise<void> {
  const user = await requireUser();
  const admin = createAdminClient();
  const supabase = await createClient();
  const jar = await cookies();
  const { data: acct } = await admin
    .from("demo_accounts")
    .select("owner_id, profiles!demo_accounts_owner_id_fkey(email)")
    .eq("user_id", user.id)
    .maybeSingle();
  await supabase.auth.signOut({ scope: "local" });
  jar.delete(DEMO_COOKIE);
  const email = (acct?.profiles as unknown as { email: string } | null)?.email;
  if (!email) redirect("/login");

  const { data: latest } = await admin
    .from("demo_events")
    .select("event_id")
    .eq("owner_id", acct!.owner_id)
    .order("last_used_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await getOrigin()}/auth/callback`, shouldCreateUser: false },
  });
  if (error) {
    console.error("Back-to-me sign-in link failed", { status: error.status, code: error.code, message: error.message });
    redirect(`/login?email=${encodeURIComponent(email)}`);
  }
  // The sign-in link lands back on the event (see /auth/callback).
  if (latest) {
    jar.set("fc_next", `/dashboard/events/${latest.event_id}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60,
      path: "/",
    });
  }
  revalidatePath("/", "layout");
  redirect(`/login?email=${encodeURIComponent(email)}&sent=1`);
}

/** Take the demo people back off an event (from the admin's own account). */
export async function endDemo(eventId: string): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!(await supabase.rpc("is_platform_admin")).data) return { error: "Only FieldCommand admins can use demo mode." };
  const { error } = await createAdminClient().rpc("demo_leave", { p_owner: user.id, p_event: eventId });
  if (error) {
    console.error("demo_leave failed", error);
    return { error: "We couldn't remove the demo people. Please try again." };
  }
  revalidatePath(`/dashboard/events/${eventId}`, "layout");
  return { ok: true, message: "The demo people are off this event." };
}
