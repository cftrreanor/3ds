import "server-only";
import { DEFAULT_SETTINGS, LEGACY_SETTINGS_COLUMNS, SETTINGS_COLUMNS, WEEKLY_SETTINGS_COLUMNS, type ConferenceSettings } from "@/lib/conferences";
import { isSchemaError } from "@/lib/schema-check";
import type { createAdminClient, createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

/**
 * A conference's saved settings (null if none yet), with defaults for
 * anything missing. Before the weekly hours (20261211000000) and several
 * ways to meet (20261213000000) updates have been run, reads the older
 * columns, so existing conferences keep working.
 */
export async function loadConferenceSettings(client: Client, eventId: string) {
  const read = (columns: string) => client.from("conference_settings").select(columns).eq("event_id", eventId).maybeSingle();
  let { data, error } = await read(SETTINGS_COLUMNS);
  const modesColumn = !isSchemaError(error);
  // Before the several-ways-to-meet update (20261213000000): the weekly columns, then before those.
  if (isSchemaError(error)) ({ data, error } = await read(WEEKLY_SETTINGS_COLUMNS));
  const legacy = isSchemaError(error);
  if (legacy) ({ data, error } = await read(LEGACY_SETTINGS_COLUMNS));
  const saved = (data ?? null) as Partial<ConferenceSettings> | null;
  const settings: ConferenceSettings = { ...DEFAULT_SETTINGS, ...(saved ?? {}), breaks: saved?.breaks ?? [] };
  return { saved: saved ? settings : null, settings, error, legacy, modesColumn };
}
