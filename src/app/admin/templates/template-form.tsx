"use client";

import { useCallback, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";
import { MERGE_FIELDS } from "@/lib/merge-fields";

const field =
  "w-full rounded-sm border border-border bg-surface px-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

/** Create or edit an email template, with buttons that insert merge fields. */
export function TemplateForm({
  action,
  template,
  onDelete,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  template?: { id: string; name: string; subject: string; body: string };
  onDelete?: () => Promise<void>;
}) {
  const [body, setBody] = useState(template?.body ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  // Stable, so the form clears once after saving a new template (not on every render).
  const cleared = useCallback(() => setBody(""), []);
  const insert = (key: string) => {
    const el = ref.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <ActionForm action={action} resetOnSuccess={!template} onSuccess={template ? undefined : cleared} className="space-y-2">
      {template && <input type="hidden" name="id" value={template.id} />}
      <input name="name" required maxLength={120} defaultValue={template?.name} placeholder="Template name, e.g. Welcome to the pilot" aria-label="Template name" className={`${field} h-8`} />
      <input name="subject" required maxLength={300} defaultValue={template?.subject} placeholder="Subject" aria-label="Subject" className={`${field} h-8`} />
      <textarea
        ref={ref}
        name="body"
        required
        maxLength={10000}
        rows={8}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={"Hi {{first_name}},\n\n…\n\n{{my_name}}"}
        aria-label="Message"
        className={`${field} py-2`}
      />
      <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
        Insert:
        {MERGE_FIELDS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => insert(f.key)}
            className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-brand"
            title={`Adds {{${f.key}}}`}
          >
            {f.label}
          </button>
        ))}
      </p>
      <div className="flex items-center justify-between gap-2">
        {onDelete ? (
          <button
            type="button"
            onClick={async () => {
              if (window.confirm("Delete this template?")) await onDelete();
            }}
            className="text-sm text-muted hover:text-danger"
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <SubmitButton className="h-8 min-h-8! rounded-sm px-3">{template ? "Save changes" : "Save template"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
