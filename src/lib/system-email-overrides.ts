import "server-only";
import { systemEmail, systemEmailWords, type SystemEmailText } from "@/lib/system-emails";
import { brand } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/server";

// The daily job and a booking with several parents send many emails at once: keep each answer for a short while.
const recent = new Map<string, { at: number; value: SystemEmailText | null }>();
const KEEP_MS = 30_000;

/** An admin's saved wording for a system email, or null for the built-in wording (or before the database update). */
export async function loadSystemEmail(key: string): Promise<SystemEmailText | null> {
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.value;
  const value = await readSystemEmail(key);
  recent.set(key, { at: Date.now(), value });
  return value;
}

async function readSystemEmail(key: string): Promise<SystemEmailText | null> {
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
