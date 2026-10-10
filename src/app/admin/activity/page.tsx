import type { Metadata } from "next";
import { ADMIN_LOG_COLUMNS, describeAdminLog, requirePlatformAdmin, type AdminLogRow } from "@/lib/admin";
import { stamp } from "@/lib/admin-crm";
import { createAdminClient } from "@/lib/supabase/server";
import { EmptyRow, PageHeader, RecordLink, Table, Td, Th, Tr } from "../kit";

export const metadata: Metadata = { title: "Activity" };

type Row = AdminLogRow & { organization_id: string | null };

/** Every change made from the admin dashboard, newest first. */
export default async function AdminActivityPage() {
  await requirePlatformAdmin();
  const { data } = await createAdminClient()
    .from("admin_log")
    .select(`organization_id, ${ADMIN_LOG_COLUMNS}`)
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <PageHeader title="Activity" sub="Every change made from the admin dashboard (plans, host invitations), newest first." />
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Account</Th>
            <Th>Change</Th>
            <Th>Note</Th>
            <Th>By</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="whitespace-nowrap text-muted">{stamp(r.created_at)}</Td>
              <Td className="whitespace-nowrap">
                {r.organization && r.organization_id ? (
                  <RecordLink href={`/admin/accounts/${r.organization_id}`}>{r.organization.name}</RecordLink>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Td>
              <Td>{describeAdminLog(r)}</Td>
              <Td className="text-muted">{r.details.note ? `“${r.details.note}”` : ""}</Td>
              <Td className="whitespace-nowrap text-muted">{r.admin?.full_name || r.admin?.email || "Unknown admin"}</Td>
            </Tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={5}>Nothing yet. Plan changes and host invitations show up here.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
