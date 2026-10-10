"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";
import { brand } from "@/lib/brand";
import { EmailPreview, editorField, FormatBar, FormatHelp, SAMPLE_VARS } from "../email-editor";

/**
 * The template builder: name, subject and message on the left, a live
 * preview of the finished email (with sample details) on the right.
 */
export function TemplateBuilder({
  action,
  template,
  onDelete,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  template?: { id: string; name: string; subject: string; body: string };
  onDelete?: () => Promise<void>;
}) {
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  // Stable, so a new template's form clears once after saving (not on every render).
  const cleared = useCallback(() => {
    setSubject("");
    setBody("");
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ActionForm action={action} resetOnSuccess={!template} onSuccess={template ? undefined : cleared} className="min-w-0 space-y-3">
        {template && <input type="hidden" name="id" value={template.id} />}
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Template name (only you see this)</span>
          <input name="name" required maxLength={120} defaultValue={template?.name} placeholder="e.g. Welcome to the pilot" className={`${editorField} h-9`} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Subject</span>
          <input
            name="subject"
            required
            maxLength={300}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`e.g. Welcome to ${brand.name}, {{first_name}}`}
            className={`${editorField} h-9`}
          />
        </label>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted">Message</span>
          <FormatBar areaRef={ref} value={body} onChange={setBody} />
          <textarea
            ref={ref}
            name="body"
            required
            maxLength={10000}
            rows={18}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi {{first_name}},\n\nWrite your message here.\n\n{{my_name}}"}
            aria-label="Message"
            className={`${editorField} py-2 font-mono text-[13px] leading-6`}
          />
          <FormatHelp />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex gap-3 text-sm">
            {template && (
              <Link href="/admin/templates" className="text-muted hover:text-foreground">
                Close
              </Link>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Delete this template?")) await onDelete();
                }}
                className="text-muted hover:text-danger"
              >
                Delete template
              </button>
            )}
          </div>
          <SubmitButton className="h-9 min-h-9! rounded-sm px-4">{template ? "Save changes" : "Save template"}</SubmitButton>
        </div>
      </ActionForm>
      <div className="min-w-0 space-y-1">
        <span className="text-xs font-semibold text-muted">Preview</span>
        <EmailPreview subject={subject} body={body} vars={{ ...SAMPLE_VARS, my_name: "You" }} note="Shown with sample details; each person gets their own." />
      </div>
    </div>
  );
}
