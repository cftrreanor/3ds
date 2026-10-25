import "server-only";
import { systemEmail, systemEmailWords, type SystemEmailText } from "@/lib/system-emails";
import { brand } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/server";

/** An admin's saved wording for a system email, or null for the built-in wording (or before the database update). */
export async function loadSystemEmail(key: string): Promise<SystemEmailText | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("system_email_overrides")
      .select("subject, heading, body, button_label")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      if (error.code !== "42P01" && error.code !== "PGRST205") console.error("loadSystemEmail failed", error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error("loadSystemEmail failed", e);
    return null;
  }
}

/** The saved wording filled in with these details, or null to use the built-in wording. */
export function customWords(key: string, saved: SystemEmailText | null, vars: Record<string, string>) {
  const email = systemEmail(key);
  if (!email || !saved) return null;
  return systemEmailWords(email, saved, { brand: brand.name, ...vars });
}
