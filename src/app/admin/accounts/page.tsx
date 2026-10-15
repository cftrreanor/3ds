import type { Metadata } from "next";
import { freeStatus, isFreePlan, PLANS, planLabel, requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ, ago, HEALTH_LABEL, HEALTH_ORDER, sortBy, type HealthLevel } from "@/lib/admin-crm";
import { formatDate, utcToZonedDate } from "@/lib/time";
import Link from "next/link";
import { bookingsByAccount, loadAccounts } from "../data";
import { EmptyRow, FilterBar, HealthPill, PageHeader, RecordLink, smallInput, SortTh, Table, Tag, Td, Tr } from "../kit";

export const metadata: Metadata = { title: "Accounts" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** Every host organization in one sortable table. */
export default async function AccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = str(sp.q).trim().toLowerCase();
  const plan = str(sp.plan);
  const health = str(sp.health);
  const kind = str(sp.kind);
  const teachers = kind === "teacher";
  const sort = str(sp.sort) || "health";
  const dir = str(sp.dir) || "asc";
  const today = utcToZonedDate(new Date().toISOString(), ADMIN_TZ);

  const all = await loadAccounts();
  const isTeacher = (a: { account_kind?: string }) => a.account_kind === "teacher";
  const rows = all
    .filter((a) => !kind || (kind === "teacher") === isTeacher(a))
    .filter((a) => !plan || a.subscription_status === plan)
    .filter((a) => !health || a.health.level === health)
    .filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.school ?? "").toLowerCase().includes(q) ||
        a.organization_members.some((m) => m.profiles?.email.toLowerCase().includes(q) || m.profiles?.full_name.toLowerCase().includes(q)),
    )
    .map((a) => ({
      ...a,
      published: a.events.filter((e) => e.status === "published").length,
      conferences: a.events.filter((e) => e.event_type === "conference").length,
      next: a.events.filter((e) => e.ends_on >= today).sort((x, y) => x.starts_on.localeCompare(y.starts_on))[0] ?? null,
    }));
  // Bookings are only shown (and counted) in the Teachers view.
  const bookings: Record<string, number> = teachers ? await bookingsByAccount(rows) : {};
  const sorted = sortBy(rows, sort, dir, {
    name: (a) => a.name.toLowerCase(),
    plan: (a) => planLabel(a.subscription_status),
    health: (a) => HEALTH_ORDER[a.health.level],
    events: (a) => a.events.length,
    next: (a) => a.next?.starts_on ?? null,
    signin: (a) => a.lastHostSignIn,
    joined: (a) => a.created_at,
    school: (a) => (a.school ?? "").toLowerCase(),
    conferences: (a) => a.conferences,
    bookings: (a) => bookings[a.id] ?? 0,
  });
  const params = Object.fromEntries(Object.entries({ q, plan, health, kind }).filter(([, v]) => v));
  const th = { sort, dir, params };

  return (
    <div>
      <PageHeader
        title="Accounts"
        sub={`${all.length} host organization${all.length === 1 ? "" : "s"} · ${all.filter(isTeacher).length} free teacher account${all.filter(isTeacher).length === 1 ? "" : "s"} · ${all.filter((a) => a.health.level === "risk").length} at risk`}
      />
      <p className="-mt-2 mb-3 text-sm">
        <Link href="/admin/accounts/schools" className="font-medium text-brand hover:underline">
          Schools with teachers →
        </Link>
      </p>
      <FilterBar>
        <input name="q" defaultValue={q} placeholder="Name, school or host email" aria-label="Search accounts" className={`${smallInput} w-56`} />
        <select name="kind" defaultValue={kind} aria-label="Account type" className={smallInput}>
          <option value="">All accounts</option>
          <option value="teacher">Teachers (free)</option>
          <option value="standard">Full accounts</option>
        </select>
        <select name="plan" defaultValue={plan} aria-label="Plan" className={smallInput}>
          <option value="">All plans</option>
          {PLANS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select name="health" defaultValue={health} aria-label="Health" className={smallInput}>
          <option value="">Any health</option>
          {(Object.keys(HEALTH_LABEL) as HealthLevel[]).map((h) => (
            <option key={h} value={h}>
              {HEALTH_LABEL[h]}
            </option>
          ))}
        </select>
      </FilterBar>
      {teachers ? (
        <Table>
          <thead>
            <tr>
              <SortTh label="Teacher" name="name" {...th} />
              <SortTh label="School" name="school" {...th} />
              <SortTh label="Signed up" name="joined" {...th} />
              <SortTh label="Last active" name="signin" {...th} />
              <SortTh label="Conferences" name="conferences" {...th} />
              <SortTh label="Bookings" name="bookings" {...th} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <Tr key={a.id}>
                <Td>
                  <RecordLink href={`/admin/accounts/${a.id}`}>{a.owner?.full_name || a.name}</RecordLink>
                  <KindTags account={a} hideTeacher />
                  <p className="text-xs text-muted">{a.owner ? a.owner.email : "No owner"}</p>
                </Td>
                <Td>{a.school || <span className="text-muted">—</span>}</Td>
                <Td className="whitespace-nowrap text-muted">{formatDate(utcToZonedDate(a.created_at, ADMIN_TZ), { weekday: undefined })}</Td>
                <Td className="whitespace-nowrap">{ago(a.lastHostSignIn)}</Td>
                <Td className="whitespace-nowrap">
                  {a.conferences}
                  <span className="text-muted"> · {a.published} published</span>
                </Td>
                <Td>{bookings[a.id] ?? 0}</Td>
              </Tr>
            ))}
            {sorted.length === 0 && <EmptyRow cols={6}>No teacher accounts match.</EmptyRow>}
          </tbody>
        </Table>
      ) : (
        <Table>
          <thead>
            <tr>
              <SortTh label="Account" name="name" {...th} />
              <SortTh label="Health" name="health" {...th} />
              <SortTh label="Plan" name="plan" {...th} />
              <SortTh label="Events" name="events" {...th} />
              <SortTh label="Next event" name="next" {...th} />
              <SortTh label="Last host sign-in" name="signin" {...th} />
              <SortTh label="Joined" name="joined" {...th} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const free = freeStatus(a);
              return (
                <Tr key={a.id}>
                  <Td>
                    <RecordLink href={`/admin/accounts/${a.id}`}>{a.name}</RecordLink>
                    <KindTags account={a} />
                    <p className="text-xs text-muted">
                      {a.owner ? a.owner.email : "No owner"}
                      {a.organization_members.length > 1 ? ` +${a.organization_members.length - 1}` : ""}
                    </p>
                  </Td>
                  <Td>
                    <HealthPill level={a.health.level} />
                    <p className="max-w-48 text-xs text-muted">{a.health.reasons[0]}</p>
                  </Td>
                  <Td>
                    <Tag tone={a.subscription_status === "active" ? "success" : isFreePlan(a.subscription_status) ? "brand" : a.subscription_status === "past_due" ? "danger" : "neutral"}>
                      {planLabel(a.subscription_status)}
                    </Tag>
                    {free && <p className={`text-xs ${free.ended || free.soon ? "text-warning" : "text-muted"}`}>{free.text}</p>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {a.published} published
                    <span className="text-muted"> / {a.events.length}</span>
                  </Td>
                  <Td>
                    {a.next ? (
                      <>
                        <span className="whitespace-nowrap">{formatDate(a.next.starts_on, { year: undefined })}</span>
                        <p className="max-w-48 truncate text-xs text-muted" title={a.next.name}>
                          {a.next.name}
                          {a.next.status !== "published" && " · draft"}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{ago(a.lastHostSignIn)}</Td>
                  <Td className="whitespace-nowrap text-muted">{formatDate(utcToZonedDate(a.created_at, ADMIN_TZ), { weekday: undefined })}</Td>
                </Tr>
              );
            })}
            {sorted.length === 0 && <EmptyRow cols={7}>No accounts match.</EmptyRow>}
          </tbody>
        </Table>
      )}
    </div>
  );
}

/** "Teacher (free)" and "Suspended", after an account's name. */
function KindTags({ account, hideTeacher = false }: { account: { account_kind?: string; suspended_at?: string | null }; hideTeacher?: boolean }) {
  const teacher = account.account_kind === "teacher" && !hideTeacher;
  if (!teacher && !account.suspended_at) return null;
  return (
    <span className="ml-1.5 inline-flex gap-1 align-middle">
      {teacher && <Tag tone="brand">Teacher (free)</Tag>}
      {account.suspended_at && <Tag tone="danger">Suspended</Tag>}
    </span>
  );
}
