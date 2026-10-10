"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { fillTemplate, MERGE_FIELDS, type MergeVars } from "@/lib/merge-fields";

type Recipient = { email: string; label: string; vars: MergeVars };
type Template = { id: string; name: string; subject: string; body: string };

const field =
  "w-full rounded-sm border border-border bg-surface px-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

/**
 * Write an email from a record page: pick recipients, start from a template
 * (or not), insert merge fields, preview it for one recipient, send. What's
 * written can also be saved as a new template.
 */
export function EmailComposer({
  recipients,
  templates,
  myName,
  send,
  saveTemplate,
}: {
  recipients: Recipient[];
  templates: Template[];
  myName: string;
  send: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  saveTemplate: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<string[]>(recipients.slice(0, 1).map((r) => r.email));
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [naming, setNaming] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [saved, saveAction, saving] = useActionState(saveTemplate, {});

  const clear = useCallback(() => {
    setSubject("");
    setBody("");
    setTemplateId("");
    setPreview(false);
  }, []);

  if (recipients.length === 0) return <p className="text-sm text-muted">No one to email here yet.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-sm bg-brand px-3 text-sm font-semibold text-brand-foreground hover:bg-brand-hover">
        Write an email
      </button>
    );
  }

  const first = recipients.find((r) => to.includes(r.email));
  const vars = { ...(first?.vars ?? {}), my_name: myName };
  const filledSubject = fillTemplate(subject, vars);
  const filledBody = fillTemplate(body, vars);
  const blank = [...new Set([...filledSubject.blank, ...filledBody.blank])];

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  };

  const insertField = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-3">
      <ActionForm action={send} resetOnSuccess={false} onSuccess={clear} className="space-y-3">
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted">To</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {recipients.map((r) => (
              <label key={r.email} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="to"
                  value={r.email}
                  checked={to.includes(r.email)}
                  onChange={(e) => setTo((cur) => (e.target.checked ? [...cur, r.email] : cur.filter((x) => x !== r.email)))}
                />
                {r.label}
                <span className="text-muted">{r.email}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {templates.length > 0 && (
          <select aria-label="Start from a template" value={templateId} onChange={(e) => applyTemplate(e.target.value)} className={`${field} h-8`}>
            <option value="">Start from a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        <input name="subject" required maxLength={300} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" className={`${field} h-8`} />
        {preview ? (
          <div className="rounded-sm border border-border bg-background p-3 text-sm">
            <p className="text-xs text-muted">
              Preview for {first?.label ?? "the first recipient"}
            </p>
            <p className="mt-1 font-semibold">{filledSubject.text || "(no subject)"}</p>
            <p className="mt-2 whitespace-pre-line">{filledBody.text || "(empty)"}</p>
            <input type="hidden" name="body" value={body} />
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            name="body"
            required
            maxLength={10000}
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi {{first_name}},\n\n…"}
            aria-label="Message"
            className={`${field} py-2`}
          />
        )}
        {!preview && (
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
            Insert:
            {MERGE_FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => insertField(f.key)}
                className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-brand"
                title={`Adds {{${f.key}}}`}
              >
                {f.label}
              </button>
            ))}
          </p>
        )}
        {blank.length > 0 && (
          <p className="text-xs text-warning">
            Empty for {first?.label ?? "this recipient"}: {blank.map((k) => MERGE_FIELDS.find((f) => f.key === k)?.label ?? k).join(", ")}. Those spots will be left blank.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-3 text-sm">
            <button type="button" onClick={() => setPreview((p) => !p)} className="font-semibold text-brand hover:underline">
              {preview ? "Edit" : "Preview"}
            </button>
            <button type="button" onClick={() => setNaming((n) => !n)} className="text-muted hover:text-foreground" disabled={!subject || !body}>
              Save as template
            </button>
            <button
              type="button"
              onClick={() => {
                clear();
                setOpen(false);
              }}
              className="text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <SubmitButton className="h-8 min-h-8! rounded-sm px-3" pendingText="Sending…" disabled={to.length === 0}>
            Send{to.length > 1 ? ` to ${to.length}` : ""}
          </SubmitButton>
        </div>
      </ActionForm>

      {naming && (
        <form action={saveAction} className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="body" value={body} />
          <input name="name" required maxLength={120} placeholder="Template name, e.g. Welcome to the pilot" aria-label="Template name" className={`${field} h-8 max-w-xs`} />
          <button disabled={saving} className="h-8 rounded-sm border border-border bg-surface px-3 text-sm font-semibold hover:bg-background disabled:opacity-50">
            {saving ? "Saving…" : "Save template"}
          </button>
          <div className="w-full">
            <FormMessage error={saved.error} success={saved.ok ? saved.message : null} />
          </div>
        </form>
      )}
    </div>
  );
}
