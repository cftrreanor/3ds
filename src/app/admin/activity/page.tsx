import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { ADMIN_LOG_COLUMNS, describeAdminLog, requirePlatformAdmin, type AdminLogRow } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { formatTime, utcToZonedDate, formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Admin activity" };

const TZ = "America/Chicago";

/** Every change made from the admin dashboard, newest first. */
export default async function AdminActivityPage() {
  await requirePlatformAdmin();
  const { data } = await createAdminClient().from("admin_log").select(ADMIN_LOG_COLUMNS).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as AdminLogRow[];
  return (
    <div>
      <h2 className="text-2xl font-semibold">Admin activity</h2>
      <p className="mt-1 text-muted">Every change made from this dashboard, newest first.</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-muted">Nothing yet. Plan changes will show up here.</p>
      ) : (
        <Card className="mt-6 p-0 sm:p-0">
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3 sm:px-6">
                <p className="font-medium">{r.organization?.name ?? "Deleted organization"}</p>
                <p className="text-sm">{describeAdminLog(r)}</p>
                {r.details.note && <p className="mt-1 text-sm text-muted">“{r.details.note}”</p>}
                <p className="mt-1 text-xs text-muted">
                  {r.admin?.full_name || r.admin?.email || "Unknown admin"} ·{" "}
                  {formatDate(utcToZonedDate(r.created_at, TZ), { year: undefined })}, {formatTime(r.created_at, TZ)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
