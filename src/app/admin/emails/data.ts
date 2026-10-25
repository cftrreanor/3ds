import "server-only";
import { isSchemaError, missing } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";
import type { SystemEmailText } from "@/lib/system-emails";

export type SavedSystemEmail = SystemEmailText & { key: string; updated_at: string; editor: { full_name: string | null } | null };

/** Every customized system email, by key. */
export async function loadSavedSystemEmails(): Promise<Map<string, SavedSystemEmail>> {
  const { data, error } = await createAdminClient()
    .from("system_email_overrides")
    .select("key, subject, heading, body, button_label, updated_at, editor:profiles!system_email_overrides_updated_by_fkey(full_name)");
  if (error) {
    if (isSchemaError(error)) missing();
    throw error;
  }
  return new Map((data as unknown as SavedSystemEmail[]).map((r) => [r.key, r]));
}
