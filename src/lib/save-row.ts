import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string } | null;

/**
 * Saves one settings row: updates it if it's there, otherwise adds it.
 *
 * Not .upsert(): an upsert also sets the key columns on update, and tables
 * whose update grant leaves out their keys (event_email_settings,
 * event_notification_recipients) refuse that with "permission denied".
 * Returns whether a row was saved (false: the row-level rules let nothing
 * through, e.g. not a host).
 */
export async function saveRow(
  supabase: Client,
  table: string,
  keys: Record<string, string>,
  values: Record<string, unknown>,
): Promise<{ saved: boolean; error: DbError }> {
  const keyColumn = Object.keys(keys)[0];
  const updated = await supabase.from(table).update(values).match(keys).select(keyColumn);
  if (updated.error) return { saved: false, error: updated.error };
  if (updated.data?.length) return { saved: true, error: null };
  const inserted = await supabase.from(table).insert({ ...keys, ...values }).select(keyColumn);
  if (inserted.error) return { saved: false, error: inserted.error };
  return { saved: Boolean(inserted.data?.length), error: null };
}
