import "server-only";
import { DEFAULT_SETTINGS, LEGACY_SETTINGS_COLUMNS, SETTINGS_COLUMNS, type ConferenceSettings } from "@/lib/conferences";
import { isSchemaError } from "@/lib/schema-check";
import type { createAdminClient, createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

/**
 * A conference's saved settings (null if none yet), with defaults for
 * anything missing. Before the weekly hours update (20261211000000) has been
 * run, reads the older columns, so existing conferences keep working.
 */
export async function loadConferenceSettings(client: Client, eventId: string) {
  const read = (columns: string) => client.from("conference_settings").select(columns).eq("event_id", eventId).maybeSingle();
  let { data, error } = await read(SETTINGS_COLUMNS);
  const legacy = isSchemaError(error);
  if (legacy) ({ data, error } = await read(LEGACY_SETTINGS_COLUMNS));
  const saved = (data ?? null) as Partial<ConferenceSettings> | null;
  const settings: ConferenceSettings = { ...DEFAULT_SETTINGS, ...(saved ?? {}), breaks: saved?.breaks ?? [] };
  return { saved: saved ? settings : null, settings, error, legacy };
}
