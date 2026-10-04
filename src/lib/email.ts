import "server-only";
import { brand } from "@/lib/brand";

// Transactional email through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
// Without RESEND_API_KEY, emails are skipped and logged, so the app still works.

const FROM = process.env.EMAIL_FROM ?? `${brand.name} <no-reply@fieldcommandevents.com>`;

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY not set; skipped email:", subject);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) {
      console.error("Resend send failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send failed", err);
    return false;
  }
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A simple, readable layout that works in every email client. */
export function emailLayout({
  heading,
  paragraphs,
  rows,
  button,
  footer,
}: {
  heading: string;
  paragraphs: string[];
  rows?: { title: string; detail: string }[];
  button?: { label: string; url: string };
  footer?: string;
}) {
  const p = (t: string) => `<p style="font-size:16px;line-height:24px;margin:0 0 16px">${escape(t)}</p>`;
  const list = rows?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px">${rows
        .map(
          (r) =>
            `<tr><td style="padding:12px 0;border-top:1px solid #e3e0d6"><div style="font-weight:bold;font-size:15px">${escape(r.title)}</div><div style="color:#5b6478;font-size:14px;line-height:20px">${escape(r.detail)}</div></td></tr>`,
        )
        .join("")}</table>`
    : "";
  const btn = button
    ? `<p style="margin:0 0 24px"><a href="${escape(button.url)}" style="background:#1d3a6e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;display:inline-block">${escape(button.label)}</a></p>`
    : "";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#14213d">
<p style="font-size:18px;font-weight:bold;margin:0 0 20px">${escape(brand.name)}</p>
<h1 style="font-size:22px;line-height:28px;margin:0 0 16px">${escape(heading)}</h1>
${paragraphs.map(p).join("")}${list}${btn}
<p style="font-size:13px;line-height:20px;color:#5b6478;margin:24px 0 0">${escape(footer ?? `Sent by ${brand.name}.`)}</p>
</div>`;
  const text = [
    heading,
    "",
    ...paragraphs,
    "",
    ...(rows ?? []).map((r) => `- ${r.title}: ${r.detail}`),
    "",
    ...(button ? [`${button.label}: ${button.url}`] : []),
  ].join("\n");
  return { html, text };
}
