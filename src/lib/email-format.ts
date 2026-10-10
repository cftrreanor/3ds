import { brand } from "@/lib/brand";

// Simple formatting for emails written in the admin dashboard, turned into a
// polished, email-client-safe layout (tables and inline styles). The same
// code renders the live preview and the email that's sent, so they match.
//
//   **bold**   *italic*   [link text](https://…)
//   # A heading                (on its own line)
//   - a bullet                 (lines starting with "- ")
//   [[Button text|https://…]]  (on its own line: a button)
//   ---                        (on its own line: a divider)
//   A blank line starts a new paragraph.

const INK = "#292827";
const MUTED = "#73706d";
const BRAND = "#1b1938";
const LINE = "#e8e4dd";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Only web and email links, so a template can't carry a javascript: link. */
const safeUrl = (u: string) => (/^(https?:\/\/|mailto:)/i.test(u.trim()) ? u.trim() : null);

/** Bold, italic and links inside one line (the line is escaped first). */
function inline(raw: string) {
  let s = escape(raw);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, text: string, url: string) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    return href ? `<a href="${escape(href)}" style="color:${BRAND};text-decoration:underline">${text}</a>` : whole;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>");
  return s;
}

const P = `margin:0 0 16px;font-size:16px;line-height:26px;color:${INK}`;

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "button"; label: string; url: string }
  | { kind: "hr" };

function parse(body: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", lines: para });
    if (list.length) blocks.push({ kind: "ul", items: list });
    para = [];
    list = [];
  };
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const t = line.trim();
    const button = t.match(/^\[\[([^|\]]+)\|([^\]]+)\]\]$/);
    if (!t) flush();
    else if (/^#{1,3}\s+/.test(t)) {
      flush();
      blocks.push({ kind: "h", text: t.replace(/^#{1,3}\s+/, "") });
    } else if (/^[-*]\s+/.test(t)) {
      if (para.length) {
        blocks.push({ kind: "p", lines: para });
        para = [];
      }
      list.push(t.replace(/^[-*]\s+/, ""));
    } else if (t === "---") {
      flush();
      blocks.push({ kind: "hr" });
    } else if (button && safeUrl(button[2])) {
      flush();
      blocks.push({ kind: "button", label: button[1].trim(), url: safeUrl(button[2])! });
    } else {
      if (list.length) {
        blocks.push({ kind: "ul", items: list });
        list = [];
      }
      para.push(t);
    }
  }
  flush();
  return blocks;
}

/** The message itself as HTML (no outer layout). */
function bodyHtml(blocks: Block[]) {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "p":
          return `<p style="${P}">${b.lines.map(inline).join("<br>")}</p>`;
        case "h":
          return `<h2 style="margin:8px 0 12px;font-size:20px;line-height:28px;font-weight:bold;color:${INK}">${inline(b.text)}</h2>`;
        case "ul":
          return `<ul style="margin:0 0 16px;padding-left:22px">${b.items
            .map((i) => `<li style="margin:0 0 6px;font-size:16px;line-height:24px;color:${INK}">${inline(i)}</li>`)
            .join("")}</ul>`;
        case "button":
          return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:8px;background:${BRAND}"><a href="${escape(b.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">${escape(b.label)}</a></td></tr></table>`;
        case "hr":
          return `<hr style="border:0;border-top:1px solid ${LINE};margin:24px 0">`;
      }
    })
    .join("\n");
}

/** The plain-text version (for email apps that don't show HTML). */
function bodyText(blocks: Block[]) {
  const plain = (s: string) =>
    s
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1$2");
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "p":
          return b.lines.map(plain).join("\n");
        case "h":
          return plain(b.text).toUpperCase();
        case "ul":
          return b.items.map((i) => `- ${plain(i)}`).join("\n");
        case "button":
          return `${b.label}: ${b.url}`;
        case "hr":
          return "----------";
      }
    })
    .join("\n\n");
}

/**
 * The brand bar: the (white) logo on indigo, or the name in white when
 * there's no address for the logo. Email apps that block images show the
 * name instead (the alt text), still white on indigo.
 */
export function brandBar(logoUrl: string | null | undefined) {
  const inner = logoUrl
    ? `<img src="${escape(logoUrl)}" alt="${escape(brand.name)}" width="78" height="48" style="display:block;height:48px;width:78px;border:0;outline:none;color:#ffffff;font-size:18px;font-weight:bold">`
    : escape(brand.name);
  return `<td style="background:${BRAND};border-radius:12px 12px 0 0;padding:${logoUrl ? "14px 28px" : "18px 28px"};font-size:18px;font-weight:bold;letter-spacing:0.3px;color:#ffffff">${inner}</td>`;
}

/** A finished email: brand bar (with the logo), white card with the message, quiet footer. */
export function renderEmail(body: string, { logoUrl }: { logoUrl?: string | null } = {}) {
  const blocks = parse(body);
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2ee">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:Helvetica,Arial,sans-serif">
<tr>${brandBar(logoUrl)}</tr>
<tr><td style="background:#ffffff;border:1px solid ${LINE};border-top:0;border-radius:0 0 12px 12px;padding:28px">
${bodyHtml(blocks)}
</td></tr>
<tr><td style="padding:16px 28px;font-size:13px;line-height:20px;color:${MUTED};text-align:center">${escape(brand.name)} · ${escape(brand.tagline)}<br>Questions? Just reply to this email.</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { html, text: bodyText(blocks) };
}
