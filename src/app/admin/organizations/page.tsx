import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Input, Select } from "@/components/ui";
import { DEFAULT_PILOT_END, freeStatus, isFreePlan, PLANS, planLabel, requirePlatformAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { setPlan } from "../actions";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Organizations" };

type OrgRow = {
  id: string;
  name: string;
  subscription_status: string;
  free_until: string | null;
  default_timezone: string;
  created_at: string;
  organization_members: { role: string; profiles: { full_name: string; email: string } | null }[];
  events: { id: string; name: string; status: string; starts_on: string }[];
};

/** Every organization, its hosts, events and plan. */
export default async function OrganizationsPage({ searchParams }: PageProps<"/admin/organizations">) {
  await requirePlatformAdmin();
  const { q, plan } = await searchParams;
  const query = typeof q === "string" ? q.trim().toLowerCase() : "";
  const planFilter = typeof plan === "string" ? plan : "";

  const { data } = await createAdminClient()
    .from("organizations")
    .select(
      "id, name, subscription_status, free_until, default_timezone, created_at, organization_members(role, profiles(full_name, email)), events(id, name, status, starts_on)",
    )
    .order("created_at", { ascending: false });
  const all = (data ?? []) as unknown as OrgRow[];
  const orgs = all.filter(
    (o) =>
      (!planFilter || o.subscription_status === planFilter) &&
      (!query ||
        o.name.toLowerCase().includes(query) ||
        o.organization_members.some(
          (m) => m.profiles?.email.toLowerCase().includes(query) || m.profiles?.full_name.toLowerCase().includes(query),
        )),
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold">Organizations</h2>
      <p className="mt-1 text-muted">
        {all.length} organization{all.length === 1 ? "" : "s"}. Publishing events needs a plan: a pilot or trial through its
        last free day, or a paid plan. When a free period ends, events already published stay live.
      </p>

      <form className="mt-5 flex flex-wrap items-center gap-2" role="search">
        <Input name="q" defaultValue={query} placeholder="Search by name or host email" aria-label="Search" className="max-w-xs" />
        <Select name="plan" defaultValue={planFilter} aria-label="Plan" className="max-w-56">
          <option value="">All plans</option>
          {PLANS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <button className="min-h-11 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-background">Filter</button>
        {(query || planFilter) && (
          <Link href="/admin/organizations" className="min-h-11 content-center px-2 text-sm font-medium text-brand hover:underline">
            Clear
          </Link>
        )}
      </form>

      <ul className="mt-6 space-y-4">
        {orgs.map((o) => {
          const today = utcToZonedDate(new Date().toISOString(), o.default_timezone);
          const owner = o.organization_members.find((m) => m.role === "owner")?.profiles;
          const cohosts = o.organization_members.filter((m) => m.role !== "owner").length;
          const published = o.events.filter((e) => e.status === "published").length;
          const next = o.events.filter((e) => e.starts_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
          const free = freeStatus(o);
          return (
            <li key={o.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{o.name}</h3>
                    <p className="text-sm text-muted">
                      {owner ? `${owner.full_name || "No name"} · ${owner.email}` : "No owner"}
                      {cohosts ? ` · ${cohosts} co-host${cohosts === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={o.subscription_status === "active" ? "success" : isFreePlan(o.subscription_status) ? "info" : "neutral"}>
                      {planLabel(o.subscription_status)}
                    </Badge>
                    {free && <Badge tone={free.ended || free.soon ? "warning" : "neutral"}>{free.text}</Badge>}
                  </div>
                </div>
                <p className="mt-3 text-sm">
                  {o.events.length} event{o.events.length === 1 ? "" : "s"} · {published} published
                  {next ? ` · Next: ${next.name}, ${formatDate(next.starts_on, { year: undefined })}` : " · Nothing upcoming"}
                  <span className="text-muted"> · Joined {formatDate(utcToZonedDate(o.created_at, o.default_timezone))}</span>
                </p>
                <details className="mt-4 rounded-lg border border-border px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold">Change plan</summary>
                  <div className="mt-4">
                    <PlanForm
                      action={setPlan.bind(null, o.id)}
                      plans={PLANS}
                      status={o.subscription_status}
                      freeUntil={o.free_until}
                      defaultEnd={DEFAULT_PILOT_END}
                    />
                  </div>
                </details>
              </Card>
            </li>
          );
        })}
        {orgs.length === 0 && <p className="text-muted">No organizations match.</p>}
      </ul>
    </div>
  );
}
