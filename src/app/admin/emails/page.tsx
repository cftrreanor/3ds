import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { ago, stamp } from "@/lib/admin-crm";
import { SYSTEM_EMAILS } from "@/lib/system-emails";
import { PageHeader, Table, Tag, Td, Th, Tr } from "../kit";
import { loadSavedSystemEmails } from "./data";

export const metadata: Metadata = { title: "System emails" };

/** The emails the app sends on its own, grouped, with which ones have your wording. */
export default async function SystemEmailsPage() {
  await requirePlatformAdmin();
  const saved = await loadSavedSystemEmails();
  const groups = [...new Set(SYSTEM_EMAILS.map((e) => e.group))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System emails"
        sub="The emails the app sends on its own. Change the words here; links, times, calendar invites, and the footer stay as they are."
      />
      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{g}</h2>
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Who gets it</Th>
                <Th>Wording</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {SYSTEM_EMAILS.filter((e) => e.group === g).map((e) => {
                const mine = saved.get(e.key);
                return (
                  <Tr key={e.key}>
                    <Td className="font-medium">{e.name}</Td>
                    <Td className="text-muted">{e.description}</Td>
                    <Td className="whitespace-nowrap">
                      {mine ? (
                        <span title={stamp(mine.updated_at)}>
                          <Tag tone="brand">Edited</Tag> <span className="text-xs text-muted">{ago(mine.updated_at)}</span>
                        </span>
                      ) : (
                        <span className="text-muted">Original</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Link href={`/admin/emails/${e.key}`} className="text-sm font-semibold text-brand hover:underline">
                        Edit
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      ))}
    </div>
  );
}
