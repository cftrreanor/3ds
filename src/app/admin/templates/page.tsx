import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/admin";
import { ago } from "@/lib/admin-crm";
import { MERGE_FIELDS } from "@/lib/merge-fields";
import { loadTemplates } from "../data";
import { deleteTemplate, saveTemplate } from "../email-actions";
import { PageHeader, Panel } from "../kit";
import { TemplateForm } from "./template-form";

export const metadata: Metadata = { title: "Email templates" };

/** Reusable emails for the "Email" box on account, person and pilot request pages. */
export default async function TemplatesPage() {
  await requirePlatformAdmin();
  const templates = await loadTemplates();
  return (
    <div>
      <PageHeader
        title="Email templates"
        sub="Start an email from one of these on any account, person or pilot request page. Merge fields like {{first_name}} are filled in for each person."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          {templates.map((t) => (
            <details key={t.id} className="rounded-md border border-border bg-surface">
              <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2">
                <span className="font-semibold">{t.name}</span>
                <span className="text-xs text-muted">Edited {ago(t.updated_at)}</span>
              </summary>
              <div className="border-t border-border p-3">
                <TemplateForm action={saveTemplate} template={t} onDelete={deleteTemplate.bind(null, t.id)} />
              </div>
            </details>
          ))}
          {templates.length === 0 && <p className="text-sm text-muted">No templates yet. Make one on the right, or write an email on any record page and choose “Save as template”.</p>}
        </div>
        <div className="space-y-4">
          <Panel title="New template">
            <TemplateForm action={saveTemplate} />
          </Panel>
          <Panel title="Merge fields">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
              {MERGE_FIELDS.map((f) => (
                <div key={f.key} className="contents">
                  <dt className="font-mono text-xs leading-5">{`{{${f.key}}}`}</dt>
                  <dd className="text-muted">{f.label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted">Plan, free-through date and next event come from the account, so they&apos;re blank when emailing a person or a pilot request.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
