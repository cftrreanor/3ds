import "server-only";
import nodemailer from "nodemailer";
import { brand } from "@/lib/brand";
import { isDemoEmail } from "@/lib/demo-email";
import { createAdminClient } from "@/lib/supabase/server";

// Transactional email through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
// Without RESEND_API_KEY, emails are skipped and logged, so the app still works.

const FROM = process.env.EMAIL_FROM ?? `${brand.name} <no-reply@fieldcommandevents.com>`;

/**
 * Notes each email in email_log, for the admin dashboard's person and account
 * pages ("did they get it?"). Never stops an email from going out.
 */
async function logEmail(to: string, subject: string, status: "sent" | "failed" | "skipped", error?: string, by?: EmailAuthor) {
  try {
    const { error: dbError } = await createAdminClient()
      .from("email_log")
      .insert({
        to_email: to,
        subject: subject.slice(0, 300),
        status,
        error: error ? error.slice(0, 500) : null,
        ...(by ? { sent_by: by.userId, body: by.body.slice(0, 10000) } : {}),
      });
    if (dbError) console.error("email_log insert failed", dbError.message);
  } catch (err) {
    console.error("email_log insert failed", err);
  }
}

/** For emails written by a person (the admin dashboard): who, and what it said. */
export type EmailAuthor = { userId: string; body: string };

export type EmailAttachment = { filename: string; content: string; contentType: string };

/**
 * A calendar invitation (iCalendar text). It's embedded the way Google and
 * Outlook send their own invites: as a text/calendar part of the message
 * itself, plus an .ics attachment. Gmail only applies updates and
 * cancellations reliably in that form.
 */
export type CalendarInvite = { method: "REQUEST" | "CANCEL"; content: string };

/** The exact message we send for an invite (also used by tests). */
export function inviteMessage({
  to,
  subject,
  html,
  text,
  invite,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  invite: CalendarInvite;
}) {
  return {
    from: FROM,
    to,
    subject,
    html,
    text,
    icalEvent: {
      method: invite.method,
      filename: invite.method === "CANCEL" ? "cancel.ics" : "invite.ics",
      content: invite.content,
    },
  };
}

/** Invites go through Resend's SMTP service (same API key), which lets us shape the message. */
async function sendInvite(message: Parameters<typeof inviteMessage>[0]): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY not set; skipped email:", message.subject);
    await logEmail(message.to, message.subject, "skipped", "Email isn't set up (RESEND_API_KEY)");
    return false;
  }
  try {
    const transport = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: key },
    });
    await transport.sendMail(inviteMessage(message));
    await logEmail(message.to, message.subject, "sent");
    return true;
  } catch (err) {
    console.error("Invite email failed", err);
    await logEmail(message.to, message.subject, "failed", err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
  invite,
  author,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  invite?: CalendarInvite;
  author?: EmailAuthor;
}): Promise<boolean> {
  // Demo people (src/lib/demo.ts) have made-up addresses: never email them.
  if (isDemoEmail(to)) return true;
  if (invite) return sendInvite({ to, subject, html, text, invite });
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY not set; skipped email:", subject);
    await logEmail(to, subject, "skipped", "Email isn't set up (RESEND_API_KEY)", author);
    return false;
  }
  const send = (withAttachments: boolean) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(withAttachments && attachments?.length
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: Buffer.from(a.content, "utf8").toString("base64"),
                content_type: a.contentType,
              })),
            }
          : {}),
      }),
    });
  try {
    let res = await send(true);
    if (!res.ok && res.status === 422 && attachments?.length) {
      // Don't lose the whole email over an attachment problem.
      console.error("Resend rejected attachments; resending without", await res.text());
      res = await send(false);
    }
    if (!res.ok) {
      const body = await res.text();
      console.error("Resend send failed", res.status, body);
      await logEmail(to, subject, "failed", `${res.status} ${body}`, author);
      return false;
    }
    await logEmail(to, subject, "sent", undefined, author);
    return true;
  } catch (err) {
    console.error("Resend send failed", err);
    await logEmail(to, subject, "failed", err instanceof Error ? err.message : String(err), author);
    return false;
  }
}

/** Resend allows about 2 requests per second on the free plan. */
export const pause = (ms = 600) => new Promise((r) => setTimeout(r, ms));

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A personal note (written in the admin dashboard): the brand line, then the
 * text as paragraphs, with no heading or button. Blank lines split paragraphs;
 * single line breaks are kept.
 */
export function personalEmail(body: string) {
  const paragraphs = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#172033">
<p style="font-size:18px;font-weight:bold;margin:0 0 20px">${escape(brand.name)}</p>
${paragraphs.map((p) => `<p style="font-size:16px;line-height:24px;margin:0 0 16px">${escape(p).replace(/\n/g, "<br>")}</p>`).join("")}
</div>`;
  return { html, text: paragraphs.join("\n\n") };
}

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
  rows?: { title: string; detail: string; links?: { label: string; url: string }[] }[];
  button?: { label: string; url: string };
  footer?: string;
}) {
  const p = (t: string) => `<p style="font-size:16px;line-height:24px;margin:0 0 16px">${escape(t)}</p>`;
  const list = rows?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px">${rows
        .map(
          (r) =>
            `<tr><td style="padding:12px 0;border-top:1px solid #d9e0ea"><div style="font-weight:bold;font-size:15px">${escape(r.title)}</div><div style="color:#5b667a;font-size:14px;line-height:20px">${escape(r.detail)}</div>${
              r.links?.length
                ? `<div style="font-size:14px;line-height:22px;margin-top:4px">${r.links
                    .map((l) => `<a href="${escape(l.url)}" style="color:#1749d8;font-weight:bold">${escape(l.label)}</a>`)
                    .join(" &nbsp;·&nbsp; ")}</div>`
                : ""
            }</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const btn = button
    ? `<p style="margin:0 0 24px"><a href="${escape(button.url)}" style="background:#1749d8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">${escape(button.label)}</a></p>`
    : "";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#172033">
<p style="font-size:18px;font-weight:bold;margin:0 0 20px">${escape(brand.name)}</p>
<h1 style="font-size:22px;line-height:28px;margin:0 0 16px">${escape(heading)}</h1>
${paragraphs.map(p).join("")}${list}${btn}
<p style="font-size:13px;line-height:20px;color:#5b667a;margin:24px 0 0">${escape(footer ?? `Sent by ${brand.name}.`)}</p>
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
