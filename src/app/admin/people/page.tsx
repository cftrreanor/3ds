import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ, ago, personRoles, ROLE_FILTERS, ROLE_LABEL, sortBy } from "@/lib/admin-crm";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { signIns } from "../data";
import { EmptyRow, FilterBar, PageHeader, RecordLink, smallInput, SortTh, Table, Tag, Td, Tr } from "../kit";

export const metadata: Metadata = { title: "People" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

type Person = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  organization_members: { role: string }[];
  event_staff: { role: string }[];
  bands: { id: string }[];
};

/** Everyone with an account: search by name or email, filter by role. */
export default async function PeoplePage({ searchParams }: PageProps<"/admin/people">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = str(sp.q).trim().toLowerCase();
  const role = str(sp.role);
  const sort = str(sp.sort) || "signin";
  const dir = str(sp.dir) || "desc";

  const [{ data }, logins] = await Promise.all([
    createAdminClient()
      .from("profiles")
      .select("id, full_name, email, phone, created_at, organization_members(role), event_staff(role), bands!bands_director_user_id_fkey(id)")
      .order("created_at", { ascending: false })
      .limit(2000),
    signIns(),
  ]);
  const all = (data ?? []) as unknown as Person[];
  const rows = all
    .map((p) => ({ ...p, roles: personRoles(p), login: logins.get(p.id)?.last_sign_in_at ?? null }))
    .filter((p) => !q || p.email.toLowerCase().includes(q) || p.full_name.toLowerCase().includes(q) || (p.phone ?? "").includes(q))
    .filter((p) => !role || (role === "none" ? p.roles.length === 0 : p.roles.includes(role)));
  const sorted = sortBy(rows, sort, dir, {
    name: (p) => (p.full_name || p.email).toLowerCase(),
    email: (p) => p.email.toLowerCase(),
    signin: (p) => p.login,
    joined: (p) => p.created_at,
  });
  const params = Object.fromEntries(Object.entries({ q, role }).filter(([, v]) => v));
  const th = { sort, dir, params };

  return (
    <div>
      <PageHeader title="People" sub={`${all.length} account${all.length === 1 ? "" : "s"}. Volunteers and parents don't have accounts; search their email in the top bar to see what we've sent them.`} />
      <FilterBar>
        <input name="q" defaultValue={q} placeholder="Name, email or phone" aria-label="Search people" className={`${smallInput} w-56`} />
        <select name="role" defaultValue={role} aria-label="Role" className={smallInput}>
          <option value="">Everyone</option>
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <SortTh label="Name" name="name" {...th} />
            <SortTh label="Email" name="email" {...th} />
            <th className="sticky top-0 border-b border-border bg-background px-3 py-2 text-left text-xs font-semibold text-muted">Roles</th>
            <SortTh label="Last sign-in" name="signin" {...th} />
            <SortTh label="Joined" name="joined" {...th} />
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 500).map((p) => (
            <Tr key={p.id}>
              <Td>
                <RecordLink href={`/admin/people/${p.id}`}>{p.full_name || "No name"}</RecordLink>
              </Td>
              <Td className="text-muted">{p.email}</Td>
              <Td>
                <span className="flex flex-wrap gap-1">
                  {p.roles.length ? p.roles.map((r) => <Tag key={r}>{ROLE_LABEL[r]}</Tag>) : <span className="text-muted">—</span>}
                </span>
              </Td>
              <Td className="whitespace-nowrap">{ago(p.login)}</Td>
              <Td className="whitespace-nowrap text-muted">{formatDate(utcToZonedDate(p.created_at, ADMIN_TZ), { weekday: undefined })}</Td>
            </Tr>
          ))}
          {sorted.length === 0 && <EmptyRow cols={5}>No one matches.</EmptyRow>}
        </tbody>
      </Table>
      {sorted.length > 500 && <p className="mt-2 text-sm text-muted">Showing the first 500. Narrow the search to see more.</p>}
    </div>
  );
}
