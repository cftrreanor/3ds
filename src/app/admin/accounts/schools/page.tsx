import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ, ago, sortBy } from "@/lib/admin-crm";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { bookingsByAccount, loadAccounts } from "../../data";
import { EmptyRow, PageHeader, RecordLink, SortTh, Table, Td, Tr } from "../../kit";

export const metadata: Metadata = { title: "Schools with teachers" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** "Lincoln Elementary" and "lincoln elementary " are the same school. */
const schoolKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Free teacher accounts grouped by school: where several teachers at one
 * school already use it (a lead for a school-wide pilot).
 */
export default async function SchoolsPage({ searchParams }: PageProps<"/admin/accounts/schools">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const sort = str(sp.sort) || "teachers";
  const dir = str(sp.dir) || "desc";

  const teachers = (await loadAccounts()).filter((a) => a.account_kind === "teacher");
  const bookings = await bookingsByAccount(teachers);
  const groups = new Map<string, typeof teachers>();
  for (const t of teachers) {
    const key = schoolKey(t.school || "(No school given)");
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const rows = [...groups.values()].map((list) => ({
    school: list[0].school || "(No school given)",
    teachers: list,
    conferences: list.reduce((n, t) => n + t.events.filter((e) => e.event_type === "conference").length, 0),
    bookings: list.reduce((n, t) => n + (bookings[t.id] ?? 0), 0),
    newest: list.map((t) => t.created_at).sort().at(-1)!,
    lastActive: list.map((t) => t.lastHostSignIn).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null,
  }));
  const sorted = sortBy(rows, sort, dir, {
    school: (r) => r.school.toLowerCase(),
    teachers: (r) => r.teachers.length,
    conferences: (r) => r.conferences,
    bookings: (r) => r.bookings,
    newest: (r) => r.newest,
    active: (r) => r.lastActive,
  });
  const th = { sort, dir, params: {} };

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/admin/accounts?kind=teacher" className="text-muted hover:text-foreground">
          ← Teacher accounts
        </Link>
      </p>
      <PageHeader
        title="Schools with teachers"
        sub={`${teachers.length} free teacher account${teachers.length === 1 ? "" : "s"} at ${rows.length} school${rows.length === 1 ? "" : "s"} · schools with several teachers are pilot leads`}
      />
      <Table>
        <thead>
          <tr>
            <SortTh label="School" name="school" {...th} />
            <SortTh label="Teachers" name="teachers" {...th} />
            <SortTh label="Conferences" name="conferences" {...th} />
            <SortTh label="Bookings" name="bookings" {...th} />
            <SortTh label="Newest sign-up" name="newest" {...th} />
            <SortTh label="Last active" name="active" {...th} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <Tr key={r.school}>
              <Td className="font-medium">{r.school}</Td>
              <Td>
                <span className="font-semibold">{r.teachers.length}</span>
                <ul className="mt-0.5 space-y-0.5 text-xs">
                  {r.teachers.map((t) => (
                    <li key={t.id}>
                      <RecordLink href={`/admin/accounts/${t.id}`}>{t.owner?.full_name || t.name}</RecordLink>
                      <span className="text-muted"> · {t.owner?.email}</span>
                    </li>
                  ))}
                </ul>
              </Td>
              <Td>{r.conferences}</Td>
              <Td>{r.bookings}</Td>
              <Td className="whitespace-nowrap text-muted">{formatDate(utcToZonedDate(r.newest, ADMIN_TZ), { weekday: undefined })}</Td>
              <Td className="whitespace-nowrap">{ago(r.lastActive)}</Td>
            </Tr>
          ))}
          {sorted.length === 0 && <EmptyRow cols={6}>No teacher accounts yet.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
