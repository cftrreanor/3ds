import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_LOG_COLUMNS, DEFAULT_PILOT_END, describeAdminLog, freeStatus, isFreePlan, PLANS, planLabel, requirePlatformAdmin, type AdminLogRow } from "@/lib/admin";
import { ADMIN_TZ, ago, byNewest, stageLabel, type TimelineItem } from "@/lib/admin-crm";
import { eventTypeLabel } from "@/lib/event-types";
import { missing } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { setPlan } from "../../actions";
import { loadAccount, NOTE_COLUMNS, signIns, type EmailRow, type NoteRow } from "../../data";
import { EmptyRow, Facts, HealthPill, PageHeader, Panel, RecordLink, Table, Tag, Td, Th, Tr } from "../../kit";
import { NoteComposer } from "../../note-composer";
import { addNote } from "../../notes-actions";
import { emailItems, noteItems, Timeline } from "../../timeline";
import { PlanForm } from "../plan-form";

export const metadata: Metadata = { title: "Account" };

/** One host organization: its health, hosts, events, plan and everything that's happened. */
export default async function AccountPage({ params }: PageProps<"/admin/accounts/[accountId]">) {
  await requirePlatformAdmin();
  const { accountId } = await params;
  const account = await loadAccount(accountId);
  if (!account) missing();

  const admin = createAdminClient();
  const eventIds = account.events.map((e) => e.id);
  // Groups and volunteers per event (counted in the database, so big events count right).
  const countPerEvent = async (table: "bands" | "volunteers") => {
    const counts = await Promise.all(
      eventIds.map((id) => admin.from(table).select("id", { count: "exact", head: true }).eq("event_id", id)),
    );
    return Object.fromEntries(eventIds.map((id, i) => [id, counts[i].count ?? 0])) as Record<string, number>;
  };
  const hostEmails = account.organization_members.map((m) => m.profiles?.email).filter((e): e is string => Boolean(e));
  const [{ data: requestData }, { data: logData }, { data: inviteData }, { data: emailData }, bands, volunteers, logins] =
    await Promise.all([
      admin.from("pilot_requests").select("id, name, email, status, created_at").eq("organization_id", accountId),
      admin.from("admin_log").select(ADMIN_LOG_COLUMNS).eq("organization_id", accountId).order("created_at", { ascending: false }).limit(100),
      admin.from("host_invitations").select("email, invited_at, used_at").eq("organization_id", accountId),
      hostEmails.length
        ? admin.from("email_log").select("*").in("to_email", hostEmails).order("created_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [] }),
      countPerEvent("bands"),
      countPerEvent("volunteers"),
      signIns(),
    ]);
  const requests = (requestData ?? []) as { id: string; name: string; email: string; status: string; created_at: string }[];
  const requestIds = requests.map((r) => r.id);
  const { data: noteData } = await admin
    .from("admin_notes")
    .select(NOTE_COLUMNS)
    .or([`organization_id.eq.${accountId}`, ...(requestIds.length ? [`pilot_request_id.in.(${requestIds.join(",")})`] : [])].join(","))
    .order("created_at", { ascending: false });
  const notes = (noteData ?? []) as unknown as NoteRow[];
  const log = (logData ?? []) as unknown as AdminLogRow[];
  const invites = (inviteData ?? []) as { email: string; invited_at: string; used_at: string | null }[];
  const today = utcToZonedDate(new Date().toISOString(), ADMIN_TZ);
  const free = freeStatus(account);
  const openFollowUps = notes.filter((n) => n.follow_up_on && !n.done_at);
  const events = [...account.events].sort((a, b) => b.starts_on.localeCompare(a.starts_on));

  const items: TimelineItem[] = [
    { at: account.created_at, kind: "account", title: "Organization set up" },
    ...requests.map((r) => ({
      at: r.created_at,
      kind: "pipeline" as const,
      title: `Pilot request from ${r.name}`,
      detail: `Stage: ${stageLabel(r.status)}`,
      href: `/admin/pipeline/${r.id}`,
    })),
    ...invites.map((i) => ({ at: i.invited_at, kind: "pipeline" as const, title: `Host invitation sent to ${i.email}` })),
    ...account.events.map((e) => ({
      at: e.created_at,
      kind: "event" as const,
      title: `Created ${e.name}`,
      detail: `${eventTypeLabel(e.event_type)} · ${formatDate(e.starts_on, { year: undefined })} · ${e.status}`,
    })),
    ...log.map((r) => ({
      at: r.created_at,
      kind: "admin" as const,
      title: describeAdminLog(r),
      detail: [r.details.note ? `“${r.details.note}”` : null, r.admin ? `by ${r.admin.full_name || r.admin.email}` : null].filter(Boolean).join(" · ") || null,
    })),
    ...noteItems(notes),
    ...emailItems((emailData ?? []) as EmailRow[], hostEmails.length > 1),
  ];
  items.sort(byNewest);

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/admin/accounts" className="text-muted hover:text-foreground">
          ← Accounts
        </Link>
      </p>
      <PageHeader
        title={account.name}
        sub={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <HealthPill level={account.health.level} />
            <Tag tone={account.subscription_status === "active" ? "success" : isFreePlan(account.subscription_status) ? "brand" : "neutral"}>
              {planLabel(account.subscription_status)}
            </Tag>
            {free && <span className={free.ended || free.soon ? "text-warning" : ""}>{free.text}</span>}
            <span>Joined {formatDate(utcToZonedDate(account.created_at, ADMIN_TZ), { weekday: undefined })}</span>
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Panel title={`Events (${events.length})`} flush>
            <Table className="rounded-none border-0">
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th>Type</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Groups</Th>
                  <Th className="text-right">Volunteers</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <Tr key={e.id}>
                    <Td className="font-medium">{e.name}</Td>
                    <Td className="whitespace-nowrap text-muted">{eventTypeLabel(e.event_type)}</Td>
                    <Td className={`whitespace-nowrap ${e.ends_on < today ? "text-muted" : ""}`}>{formatDate(e.starts_on, { year: undefined })}</Td>
                    <Td>
                      <Tag tone={e.status === "published" ? "success" : "neutral"}>{e.status === "published" ? "Published" : e.status === "draft" ? "Draft" : "Archived"}</Tag>
                    </Td>
                    <Td className="text-right">{bands[e.id] ?? 0}</Td>
                    <Td className="text-right">{volunteers[e.id] ?? 0}</Td>
                  </Tr>
                ))}
                {events.length === 0 && <EmptyRow cols={6}>No events yet.</EmptyRow>}
              </tbody>
            </Table>
          </Panel>

          <Panel title="Timeline" flush>
            <div className="border-b border-border p-3">
              <NoteComposer action={addNote.bind(null, { organizationId: account.id })} />
            </div>
            <Timeline items={items} today={today} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Health">
            <HealthPill level={account.health.level} />
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-muted">
              {account.health.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Panel>

          {openFollowUps.length > 0 && (
            <Panel title="Open follow-ups">
              <ul className="space-y-2 text-sm">
                {openFollowUps.map((n) => (
                  <li key={n.id}>
                    <Tag tone={n.follow_up_on! <= today ? "warning" : "brand"}>{formatDate(n.follow_up_on!, { year: undefined })}</Tag>
                    <p className="mt-0.5 line-clamp-2">{n.body}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title={`Hosts (${account.organization_members.length})`} flush>
            <ul className="divide-y divide-border">
              {account.organization_members.map((m) => (
                <li key={m.user_id} className="px-3 py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <RecordLink href={`/admin/people/${m.user_id}`}>{m.profiles?.full_name || m.profiles?.email || "Unknown"}</RecordLink>
                    <Tag>{m.role === "owner" ? "Owner" : "Co-host"}</Tag>
                  </div>
                  <p className="truncate text-xs text-muted">{m.profiles?.email}</p>
                  <p className="text-xs text-muted">Last sign-in {ago(logins.get(m.user_id)?.last_sign_in_at)}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Details">
            <Facts
              items={[
                ["Plan", planLabel(account.subscription_status)],
                ["Free through", account.free_until ? formatDate(account.free_until, { weekday: undefined }) : "—"],
                ["Time zone", account.default_timezone.replace("America/", "").replaceAll("_", " ")],
                ["Pilot request", requests[0] ? <RecordLink href={`/admin/pipeline/${requests[0].id}`}>{stageLabel(requests[0].status)}</RecordLink> : "—"],
              ]}
            />
            <details className="mt-3 border-t border-border pt-3">
              <summary className="cursor-pointer text-sm font-semibold">Change plan</summary>
              <div className="mt-3">
                <PlanForm
                  action={setPlan.bind(null, account.id)}
                  plans={PLANS}
                  status={account.subscription_status}
                  freeUntil={account.free_until}
                  defaultEnd={DEFAULT_PILOT_END}
                />
              </div>
            </details>
          </Panel>
        </div>
      </div>
    </div>
  );
}
