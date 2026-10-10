import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_LOG_COLUMNS, describeAdminLog, requirePlatformAdmin, type AdminLogRow } from "@/lib/admin";
import { ADMIN_TZ, ago, HEALTH_ORDER, STAGES } from "@/lib/admin-crm";
import { eventTypeLabel } from "@/lib/event-types";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { loadAccounts } from "./data";
import { FOLLOW_UP_COLUMNS, FollowUpSubject, type FollowUpRow } from "./follow-ups/shared";
import { EmptyRow, HealthPill, PageHeader, Panel, RecordLink, Table, Tag, Td, Th, Tr } from "./kit";
import { NoteControls } from "./note-controls";
import { deleteNote, setNoteDone } from "./notes-actions";

export const metadata: Metadata = { title: "Home" };

/** The admin's day: what's due, who needs attention, what's coming up. */
export default async function AdminHomePage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const now = new Date().getTime();
  const today = utcToZonedDate(new Date(now).toISOString(), ADMIN_TZ);
  const in7 = utcToZonedDate(new Date(now + 7 * 864e5).toISOString(), ADMIN_TZ);
  const in14 = utcToZonedDate(new Date(now + 14 * 864e5).toISOString(), ADMIN_TZ);
  const weekAgo = new Date(now - 7 * 864e5).toISOString();

  const [accounts, { data: followData }, { data: requestData }, { data: soonData }, { count: failedEmails }, { data: logData }] = await Promise.all([
    loadAccounts(),
    admin.from("admin_notes").select(FOLLOW_UP_COLUMNS).is("done_at", null).lte("follow_up_on", in7).order("follow_up_on"),
    admin.from("pilot_requests").select("status"),
    admin
      .from("events")
      .select("id, name, status, event_type, starts_on, organization_id, organizations(name)")
      .gte("ends_on", today)
      .lte("starts_on", in14)
      .order("starts_on"),
    admin.from("email_log").select("id", { count: "exact", head: true }).neq("status", "sent").gte("created_at", weekAgo),
    admin.from("admin_log").select(ADMIN_LOG_COLUMNS).order("created_at", { ascending: false }).limit(6),
  ]);
  const followUps = (followData ?? []) as unknown as FollowUpRow[];
  const stages = (requestData ?? []) as { status: string }[];
  const soon = (soonData ?? []) as unknown as { id: string; name: string; status: string; event_type: string; starts_on: string; organization_id: string; organizations: { name: string } | null }[];
  const log = (logData ?? []) as unknown as AdminLogRow[];
  const attention = accounts
    .filter((a) => a.health.level === "risk" || a.health.level === "watch")
    .sort((a, b) => HEALTH_ORDER[a.health.level] - HEALTH_ORDER[b.health.level]);
  const due = followUps.filter((f) => f.follow_up_on <= today).length;
  const inPipeline = stages.filter((s) => ["new", "contacted", "invited"].includes(s.status)).length;

  const kpis = [
    { label: "Accounts", value: accounts.length, href: "/admin/accounts" },
    { label: "At risk", value: accounts.filter((a) => a.health.level === "risk").length, href: "/admin/accounts?health=risk", alert: true },
    { label: "Follow-ups due", value: due, href: "/admin/follow-ups", alert: true },
    { label: "In the pipeline", value: inPipeline, href: "/admin/pipeline" },
    { label: "Events, next 14 days", value: soon.filter((e) => e.status === "published").length },
    { label: "Emails not sent (7 days)", value: failedEmails ?? 0, alert: true },
  ];

  return (
    <div>
      <PageHeader
        title="Home"
        sub={new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: ADMIN_TZ })}
      />
      <dl className="mb-5 grid grid-cols-2 divide-border overflow-hidden rounded-md border border-border bg-surface sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        {kpis.map((k) => {
          const body = (
            <>
              <dt className="text-xs text-muted">{k.label}</dt>
              <dd className={`mt-0.5 text-2xl font-semibold tabular-nums ${k.alert && k.value > 0 ? "text-danger" : ""}`}>{k.value}</dd>
            </>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="block px-3 py-2.5 hover:bg-background">
              {body}
            </Link>
          ) : (
            <div key={k.label} className="px-3 py-2.5">
              {body}
            </div>
          );
        })}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <Panel title="Follow-ups: overdue, today and this week" actions={<Link href="/admin/follow-ups" className="text-brand hover:underline">All follow-ups</Link>} flush>
            <Table className="rounded-none border-0">
              <thead>
                <tr>
                  <Th>Due</Th>
                  <Th>About</Th>
                  <Th>Note</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {followUps.map((f) => (
                  <Tr key={f.id}>
                    <Td className="whitespace-nowrap">
                      <Tag tone={f.follow_up_on < today ? "danger" : f.follow_up_on === today ? "warning" : "neutral"}>
                        {f.follow_up_on === today ? "Today" : formatDate(f.follow_up_on, { year: undefined })}
                      </Tag>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <FollowUpSubject f={f} />
                    </Td>
                    <Td className="max-w-sm">
                      <p className="line-clamp-2">{f.body}</p>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <NoteControls followUp done={false} toggle={setNoteDone.bind(null, f.id, true)} remove={deleteNote.bind(null, f.id)} />
                    </Td>
                  </Tr>
                ))}
                {followUps.length === 0 && <EmptyRow cols={4}>Nothing due this week.</EmptyRow>}
              </tbody>
            </Table>
          </Panel>

          <Panel title={`Needs attention (${attention.length})`} actions={<Link href="/admin/accounts?sort=health" className="text-brand hover:underline">All accounts</Link>} flush>
            <Table className="rounded-none border-0">
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th>Health</Th>
                  <Th>Why</Th>
                  <Th>Last host sign-in</Th>
                </tr>
              </thead>
              <tbody>
                {attention.slice(0, 10).map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <RecordLink href={`/admin/accounts/${a.id}`}>{a.name}</RecordLink>
                    </Td>
                    <Td>
                      <HealthPill level={a.health.level} />
                    </Td>
                    <Td className="text-muted">{a.health.reasons.join(" · ")}</Td>
                    <Td className="whitespace-nowrap">{ago(a.lastHostSignIn)}</Td>
                  </Tr>
                ))}
                {attention.length === 0 && <EmptyRow cols={4}>Every account looks healthy.</EmptyRow>}
              </tbody>
            </Table>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Pipeline" actions={<Link href="/admin/pipeline" className="text-brand hover:underline">Open board</Link>}>
            <ul className="space-y-1 text-sm">
              {STAGES.map((s) => {
                const n = stages.filter((r) => r.status === s.value).length;
                return (
                  <li key={s.value} className="flex items-center justify-between gap-2">
                    <span className={s.value === "declined" ? "text-muted" : ""}>{s.label}</span>
                    <span className={`tabular-nums ${s.value === "new" && n > 0 ? "font-semibold text-danger" : "text-muted"}`}>{n}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Events in the next two weeks" flush>
            <ul className="divide-y divide-border">
              {soon.map((e) => (
                <li key={e.id} className="px-3 py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{e.name}</span>
                    <span className="text-xs whitespace-nowrap text-muted">{formatDate(e.starts_on, { year: undefined })}</span>
                  </div>
                  <p className="text-xs text-muted">
                    <Link href={`/admin/accounts/${e.organization_id}`} className="hover:underline">
                      {e.organizations?.name}
                    </Link>{" "}
                    · {eventTypeLabel(e.event_type)}
                    {e.status !== "published" && <span className="text-warning"> · not published</span>}
                  </p>
                </li>
              ))}
              {soon.length === 0 && <li className="px-3 py-3 text-sm text-muted">None scheduled.</li>}
            </ul>
          </Panel>

          <Panel title="Recent admin activity" actions={<Link href="/admin/activity" className="text-brand hover:underline">See all</Link>} flush>
            <ul className="divide-y divide-border">
              {log.map((r) => (
                <li key={r.id} className="px-3 py-2 text-sm">
                  <p>{describeAdminLog(r)}</p>
                  <p className="text-xs text-muted">
                    {r.organization ? `${r.organization.name} · ` : ""}
                    {r.admin?.full_name || r.admin?.email || "Unknown admin"} · {ago(r.created_at)}
                  </p>
                </li>
              ))}
              {log.length === 0 && <li className="px-3 py-3 text-sm text-muted">No changes yet.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
