import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { ago, stamp } from "@/lib/admin-crm";
import { MERGE_FIELDS } from "@/lib/merge-fields";
import { loadTemplates } from "../data";
import { deleteTemplate, saveTemplate } from "../email-actions";
import { EmptyRow, PageHeader, Panel, secondarySmall, Table, Td, Th, Tr } from "../kit";
import { TemplateBuilder } from "./template-form";

export const metadata: Metadata = { title: "Email templates" };

/**
 * Reusable emails: every template in a table, and the builder underneath
 * (a new template, or the one picked with "Edit").
 */
export default async function TemplatesPage({ searchParams }: PageProps<"/admin/templates">) {
  await requirePlatformAdmin();
  const { edit } = await searchParams;
  const templates = await loadTemplates();
  const editing = typeof edit === "string" ? templates.find((t) => t.id === edit) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email templates"
        sub="Start an email from one of these on any account, person or pilot request page. Fields like {{first_name}} are filled in for each person."
        actions={
          editing && (
            <Link href="/admin/templates#builder" className={secondarySmall}>
              New template
            </Link>
          )
        }
      />

      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Subject</Th>
            <Th>Last edited</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <Tr key={t.id} className={editing?.id === t.id ? "bg-brand-soft hover:bg-brand-soft" : ""}>
              <Td className="font-medium">{t.name}</Td>
              <Td className="text-muted">{t.subject}</Td>
              <Td className="whitespace-nowrap text-muted" title={stamp(t.updated_at)}>
                {ago(t.updated_at)}
              </Td>
              <Td className="text-right">
                <Link href={`/admin/templates?edit=${t.id}#builder`} className="text-sm font-semibold text-brand hover:underline">
                  {editing?.id === t.id ? "Editing" : "Edit"}
                </Link>
              </Td>
            </Tr>
          ))}
          {templates.length === 0 && <EmptyRow cols={4}>No templates yet. Build your first one below.</EmptyRow>}
        </tbody>
      </Table>

      <section id="builder" className="scroll-mt-16">
        <Panel title={editing ? `Editing “${editing.name}”` : "New template"}>
          <TemplateBuilder
            key={editing?.id ?? "new"}
            action={saveTemplate}
            template={editing}
            onDelete={editing ? deleteTemplate.bind(null, editing.id) : undefined}
          />
        </Panel>
      </section>

      <Panel title="Fields you can use">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {MERGE_FIELDS.map((f) => (
            <div key={f.key} className="flex gap-2">
              <dt className="font-mono text-xs leading-5">{`{{${f.key}}}`}</dt>
              <dd className="text-muted">{f.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">Plan, free-through date and next event come from the account, so they&apos;re blank when emailing a person or a pilot request.</p>
      </Panel>
    </div>
  );
}
