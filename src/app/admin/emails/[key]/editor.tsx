"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";
import { brand } from "@/lib/brand";
import { checkSystemText, systemEmailWords, type SystemEmail, type SystemEmailText } from "@/lib/system-emails";
import { editorField } from "../../email-editor";

/**
 * The words of one system email on the left (subject, heading, message, and
 * button), and a preview with sample details on the right. Locked lines (the
 * ones the code always adds) show in the preview but can't be edited.
 */
export function SystemEmailEditor({
  email,
  initial,
  edited,
  samples,
  action,
  onReset,
}: {
  email: SystemEmail;
  initial: SystemEmailText;
  edited: boolean;
  samples: Record<string, string>;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  onReset: () => Promise<void>;
}) {
  const [t, setT] = useState<SystemEmailText>({ ...initial, button_label: initial.button_label ?? "" });
  const set = (k: keyof SystemEmailText) => (e: { target: { value: string } }) => setT((v) => ({ ...v, [k]: e.target.value }));
  const words = systemEmailWords(email, t, samples);
  const problem = checkSystemText(email, t);
  const button = words.button || email.starting.button_label;
  const fields = [{ key: "brand", label: "Our product name", sample: brand.name }, ...email.fields];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ActionForm action={action} resetOnSuccess={false} className="min-w-0 space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Subject</span>
          <input name="subject" required maxLength={300} value={t.subject} onChange={set("subject")} className={`${editorField} h-9`} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Heading</span>
          <input name="heading" required maxLength={200} value={t.heading} onChange={set("heading")} className={`${editorField} h-9`} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Message (a blank line starts a new paragraph)</span>
          <textarea
            name="body"
            required
            maxLength={5000}
            rows={10}
            value={t.body}
            onChange={set("body")}
            className={`${editorField} py-2 font-mono text-[13px] leading-6`}
          />
        </label>
        {email.starting.button_label && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted">Button text (blank: “{email.starting.button_label}”)</span>
            <input name="button" maxLength={60} value={t.button_label ?? ""} onChange={set("button_label")} className={`${editorField} h-9`} />
          </label>
        )}

        <div className="rounded-sm border border-border bg-background p-2.5 text-xs">
          <p className="mb-1.5 font-semibold text-muted">Fields you can use (each email fills in the real details)</p>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {fields.map((f) => (
              <li key={f.key}>
                <code className="text-foreground">{`{{${f.key}}}`}</code> <span className="text-muted">{f.label}</span>
                {email.required.includes(f.key) && <span className="text-muted"> (required)</span>}
                {email.private?.includes(f.key) && <span className="text-muted"> (not in the subject)</span>}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted">Start a field with a capital letter, like {"{{Kind}}"}, to capitalize it.</p>
        </div>

        {problem && <p className="text-sm text-danger">{problem}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => setT({ ...email.starting, button_label: email.starting.button_label ?? "" })}
              className="text-muted hover:text-foreground"
            >
              Start from the original
            </button>
            {edited && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`Go back to the original wording for “${email.name}”? Your version is removed.`)) await onReset();
                }}
                className="text-muted hover:text-danger"
              >
                Reset to original
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <SubmitButton name="intent" value="test" variant="secondary" className="h-9 min-h-9! rounded-sm px-4" pendingText="Sending…">
              Send me a test
            </SubmitButton>
            <SubmitButton name="intent" value="save" className="h-9 min-h-9! rounded-sm px-4">
              Save
            </SubmitButton>
          </div>
        </div>
      </ActionForm>

      <div className="min-w-0 space-y-1">
        <span className="text-xs font-semibold text-muted">Preview with sample details</span>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="border-b border-border px-3 py-2 text-sm">
            <p>
              <span className="text-muted">From </span>
              {brand.name}
            </p>
            <p className="font-semibold">{words.subject || <span className="text-muted">(no subject)</span>}</p>
          </div>
          <div className="space-y-4 bg-[#fcfbf8] px-6 py-6 text-[#1a2733]">
            <p className="text-xl font-bold">{words.heading}</p>
            {words.paragraphs.map((p, i) => (
              <p key={i} className="leading-6">
                {p}
              </p>
            ))}
            {email.locked.map((l) => (
              <p key={l} className="border-l-2 border-[#dfe3e8] pl-2 text-sm text-[#5b6b7a] italic" title="Always added; not editable">
                {l}
              </p>
            ))}
            {button && <span className="inline-block rounded-md bg-[#0b3558] px-5 py-2.5 font-semibold text-white">{button}</span>}
            <p className="text-xs text-[#5b6b7a]">The footer, links, and any calendar invite stay as they are.</p>
          </div>
        </div>
        <p className="text-xs text-muted">
          Lines in gray are always added. The original wording changes a little in some cases (the kind of event, or no child's name);
          your version is used for all of them.
        </p>
      </div>
    </div>
  );
}
