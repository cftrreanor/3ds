import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { ADMIN_LOG_COLUMNS, describeAdminLog, freeStatus, requirePlatformAdmin, type AdminLogRow } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";

export const metadata: Metadata = { title: "Overview" };

const TZ = "America/Chicago";

/** The admin dashboard's front page: the numbers, and what needs attention. */
export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const today = utcToZonedDate(new Date().toISOString(), TZ);
  const in14 = utcToZonedDate(new Date(new Date().getTime() + 14 * 864e5).toISOString(), TZ);
  const count = (table: string) => admin.from(table).select("id", { count: "exact", head: true });

  const [{ data: orgData }, { data: soonData }, bands, volunteers, requests, upcoming, { data: logData }] = await Promise.all([
    admin.from("organizations").select("id, name, subscription_status, free_until, default_timezone"),
    admin
      .from("events")
      .select("id, name, status, starts_on, organizations(name)")
      .gte("starts_on", today)
      .lte("starts_on", in14)
      .order("starts_on"),
    count("bands"),
    count("volunteers"),
    count("pilot_requests").eq("status", "new"),
    count("events").eq("status", "published").gte("starts_on", today),
    admin.from("admin_log").select(ADMIN_LOG_COLUMNS).order("created_at", { ascending: false }).limit(5),
  ]);
  const orgs = (orgData ?? []) as { id: string; name: string; subscription_status: string; free_until: string | null; default_timezone: string }[];
  const soon = (soonData ?? []) as unknown as { id: string; name: string; status: string; starts_on: string; organizations: { name: string } | null }[];
  const log = (logData ?? []) as unknown as AdminLogRow[];
  const ending = orgs
    .map((o) => ({ ...o, free: freeStatus(o) }))
    .filter((o) => o.free && (o.free.ended || o.free.soon))
    .sort((a, b) => a.free!.left - b.free!.left);
  const by = (s: string[]) => orgs.filter((o) => s.includes(o.subscription_status)).length;

  const tiles = [
    { label: "Organizations", value: orgs.length, href: "/admin/organizations" },
    { label: "On a pilot or trial", value: by(["comped", "trialing"]), href: "/admin/organizations?plan=comped" },
    { label: "Paid", value: by(["active", "past_due"]), href: "/admin/organizations?plan=active" },
    { label: "New pilot requests", value: requests.count ?? 0, href: "/admin/pilot-requests" },
    { label: "Upcoming published events", value: upcoming.count ?? 0 },
    { label: "Bands registered (all time)", value: bands.count ?? 0 },
    { label: "Volunteers signed up (all time)", value: volunteers.count ?? 0 },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="numbers">
        <h2 id="numbers" className="sr-only">
          Numbers
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => {
            const body = (
              <>
                <p className="text-sm text-muted">{t.label}</p>
                <p className="mt-1 font-display text-4xl font-bold">{t.value}</p>
              </>
            );
            return t.href ? (
              <Link key={t.label} href={t.href} className="rounded-xl border border-border bg-surface p-4 shadow-card hover:border-brand/40">
                {body}
              </Link>
            ) : (
              <div key={t.label} className="rounded-xl border border-border bg-surface p-4 shadow-card">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="ending">
        <h2 id="ending" className="text-xl font-semibold">
          Free periods ending
        </h2>
        <p className="mt-1 text-sm text-muted">Pilots and trials that end within 30 days, or already have.</p>
        <Card className="mt-3">
          {ending.length === 0 ? (
            <p className="text-muted">None in the next 30 days.</p>
          ) : (
            <ul className="divide-y divide-border">
              {ending.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <Link href={`/admin/organizations?q=${encodeURIComponent(o.name)}`} className="font-medium text-brand hover:underline">
                    {o.name}
                  </Link>
                  <span className={`text-sm ${o.free!.ended ? "font-semibold text-warning" : "text-muted"}`}>{o.free!.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section aria-labelledby="soon">
        <h2 id="soon" className="text-xl font-semibold">
          Contests in the next two weeks
        </h2>
        <Card className="mt-3">
          {soon.length === 0 ? (
            <p className="text-muted">None scheduled.</p>
          ) : (
            <ul className="divide-y divide-border">
              {soon.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <span>
                    <span className="font-medium">{e.name}</span>
                    {e.organizations && <span className="text-sm text-muted"> · {e.organizations.name}</span>}
                  </span>
                  <span className="text-sm text-muted">
                    {formatDate(e.starts_on, { year: undefined })}
                    {e.status !== "published" && " · not published"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section aria-labelledby="recent">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="recent" className="text-xl font-semibold">
            Recent admin activity
          </h2>
          <Link href="/admin/activity" className="text-sm font-medium text-brand hover:underline">
            See all
          </Link>
        </div>
        <Card className="mt-3">
          {log.length === 0 ? (
            <p className="text-muted">No changes yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {log.map((r) => (
                <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="font-medium">{r.organization?.name ?? "Deleted organization"}</p>
                  <p className="text-sm text-muted">{describeAdminLog(r)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
