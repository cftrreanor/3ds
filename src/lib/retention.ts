import "server-only";
import { FILES_BUCKET } from "@/lib/event-files";
import { isSchemaError } from "@/lib/schema-check";
import type { createAdminClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The privacy policy's deletion schedule (20261117000000_data_retention.sql),
 * run by the daily job: closed accounts 90 days after closing (and the sign-in
 * accounts of hosts and team members left with no other role), pilot requests
 * a year old that never became an account, directors' details 2 years after
 * the event, booth contacts after 15 months, and uploaded files 30 days after.
 */
export async function runRetention(admin: Admin) {
  // Before the migration is run, every call is a schema error: skip quietly.
  const call = async (fn: string) => {
    const { data, error } = await admin.rpc(fn);
    if (error && !isSchemaError(error)) console.error(`${fn} failed`, error);
    return (data as number | null) ?? 0;
  };
  // Files first (including closed accounts' about to be deleted): out of storage,
  // then their rows. A row left behind is retried tomorrow.
  let filesDeleted = 0;
  const { data: files, error: filesError } = await admin.rpc("expired_event_files");
  if (filesError && !isSchemaError(filesError)) console.error("expired_event_files failed", filesError);
  const expired = (files ?? []) as { id: string; path: string }[];
  for (let i = 0; i < expired.length; i += 100) {
    const batch = expired.slice(i, i + 100);
    const { error: removeError } = await admin.storage.from(FILES_BUCKET).remove(batch.map((f) => f.path));
    if (removeError) {
      console.error("Removing expired files from storage failed", removeError);
      continue;
    }
    const { error } = await admin.from("event_files").delete().in("id", batch.map((f) => f.id));
    if (error) console.error("Deleting expired file rows failed", error);
    else filesDeleted += batch.length;
  }

  const accountsClosed = await call("purge_closed_accounts");
  const pilotRequestsPurged = await call("purge_pilot_requests");
  const bandDetailsRemoved = await call("purge_band_directors");
  const boothContactsRemoved = await call("purge_booth_contacts");

  // Sign-in accounts can only be deleted through Supabase's admin API.
  let usersDeleted = 0;
  const { data: due, error: dueError } = await admin.rpc("user_deletions_due");
  if (dueError && !isSchemaError(dueError)) console.error("user_deletions_due failed", dueError);
  for (const id of (due ?? []) as string[]) {
    const { error } = await admin.auth.admin.deleteUser(id);
    // A failure stays queued and is tried again tomorrow.
    if (error) console.error("Deleting a closed account's user failed", id, error);
    else usersDeleted++;
  }

  return { accountsClosed, usersDeleted, pilotRequestsPurged, bandDetailsRemoved, boothContactsRemoved, filesDeleted };
}
