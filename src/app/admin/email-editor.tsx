"use client";

import { useMemo, type RefObject } from "react";
import { renderEmail } from "@/lib/email-format";
import { fillTemplate, MERGE_FIELDS, type MergeVars } from "@/lib/merge-fields";
import { brand } from "@/lib/brand";

export const editorField =
  "w-full rounded-sm border border-border bg-surface px-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

/** Sample details for previewing a template before it's sent to anyone. */
export const SAMPLE_VARS: MergeVars = {
  first_name: "Jordan",
  name: "Jordan Lee",
  organization: "Lakeside HS Band Boosters",
  plan: "Pilot (free)",
  free_until: "Jun 30, 2027",
  next_event: "Lakeside Marching Classic (Oct 24, 2026)",
};

const tool = "h-7 min-w-7 rounded-sm border border-border bg-surface px-2 text-xs font-semibold hover:border-brand";

/**
 * Formatting buttons for an email textarea: bold, italic, heading, bullets,
 * link, button, divider, and merge fields. They insert the simple markup
 * that lib/email-format turns into a polished email.
 */
export function FormatBar({
  areaRef,
  value,
  onChange,
}: {
  areaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  const edit = (fn: (sel: string) => { text: string; cursor?: number }) => {
    const el = areaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const { text, cursor } = fn(value.slice(start, end));
    onChange(value.slice(0, start) + text + value.slice(end));
    const at = start + (cursor ?? text.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at, at);
    });
  };
  const wrap = (mark: string, placeholder: string) =>
    edit((sel) => {
      const inner = sel || placeholder;
      return { text: `${mark}${inner}${mark}` };
    });
  const lines = (prefix: string, placeholder: string) =>
    edit((sel) => {
      const block = (sel || placeholder)
        .split("\n")
        .map((l) => `${prefix}${l.replace(/^(#{1,3}|[-*])\s+/, "")}`)
        .join("\n");
      return { text: `\n${block}\n` };
    });
  const link = () => {
    const url = window.prompt("Link address (starts with https://)", "https://");
    if (!url || url === "https://") return;
    edit((sel) => ({ text: `[${sel || "link text"}](${url.trim()})` }));
  };
  const button = () => {
    const url = window.prompt("Where should the button go? (starts with https://)", "https://");
    if (!url || url === "https://") return;
    const label = window.prompt("Button text", "Open FieldCommand") || "Open";
    edit(() => ({ text: `\n[[${label.trim()}|${url.trim()}]]\n` }));
  };

  return (
    <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
      <button type="button" className={tool} onClick={() => wrap("**", "bold text")} title="Bold">
        B
      </button>
      <button type="button" className={`${tool} italic`} onClick={() => wrap("*", "italic text")} title="Italic">
        I
      </button>
      <button type="button" className={tool} onClick={() => lines("# ", "Heading")} title="Heading">
        Heading
      </button>
      <button type="button" className={tool} onClick={() => lines("- ", "List item")} title="Bulleted list">
        • List
      </button>
      <button type="button" className={tool} onClick={link} title="Link">
        Link
      </button>
      <button type="button" className={tool} onClick={button} title="Button">
        Button
      </button>
      <button type="button" className={tool} onClick={() => edit(() => ({ text: "\n---\n" }))} title="Divider line">
        Divider
      </button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <label className="flex items-center gap-1 text-xs text-muted">
        Insert field
        <select
          value=""
          onChange={(e) => {
            const key = e.target.value;
            if (key) edit(() => ({ text: `{{${key}}}` }));
          }}
          className="h-7 rounded-sm border border-border bg-surface px-1 text-xs text-foreground"
        >
          <option value="">Choose…</option>
          {MERGE_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Exactly how the email will look: inbox header, then the rendered email. */
export function EmailPreview({ subject, body, vars, note }: { subject: string; body: string; vars: MergeVars; note?: string }) {
  const filledSubject = fillTemplate(subject, vars).text;
  const filledBody = fillTemplate(body, vars).text;
  // The preview loads the logo from this site (sent emails use the site's full address).
  const html = useMemo(() => renderEmail(filledBody, { logoUrl: "/logo.png" }).html, [filledBody]);
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="border-b border-border px-3 py-2 text-sm">
        {note && <p className="mb-1 text-xs text-muted">{note}</p>}
        <p>
          <span className="text-muted">From </span>
          {brand.name}
        </p>
        <p className="font-semibold">{filledSubject || <span className="text-muted">(no subject)</span>}</p>
      </div>
      <iframe title="Email preview" sandbox="" srcDoc={html} className="h-[32rem] w-full bg-[#f4f2ee]" />
    </div>
  );
}

/** A one-line cheat sheet under the editor. */
export function FormatHelp() {
  return (
    <p className="text-xs text-muted">
      <code>**bold**</code> · <code>*italic*</code> · <code># Heading</code> · <code>- bullet</code> · <code>[text](https://…)</code> ·{" "}
      <code>[[Button|https://…]]</code> · <code>---</code> divider. A blank line starts a new paragraph.
    </p>
  );
}
