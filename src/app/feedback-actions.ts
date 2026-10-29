"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { notifyAdmins } from "@/lib/admin-alerts";
import { getUser } from "@/lib/auth";
import { BOT_CHECK_FAILED, passesBotCheck } from "@/lib/bot-check";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { emailLayout, sendEmail } from "@/lib/email";
import { FEEDBACK_KINDS, FEEDBACK_PER_HOUR, openGithubIssue, safePagePath, type FeedbackKind } from "@/lib/feedback";
import { isSchemaError } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";

const BUCKET = "feedback-screenshots";
const MAX_SCREENSHOT = 4 * 1024 * 1024;

export type FeedbackState = ActionState & { sentTo?: string | null };

const schema = z.object({
  kind: z.enum(["bug", "idea", "question"], { message: "Pick what kind of feedback this is." }),
  message: z.string().trim().min(3, "Please tell us a little more.").max(5000, "Please keep it under 5,000 characters."),
  page: z.string().trim().min(1).max(2000),
  email: z.string().trim().toLowerCase().email("Please check your email, or leave it blank.").max(254).or(z.literal("")),
});

/**
 * The Feedback button on every page. Saves the feedback first (so nothing is
 * lost), then, after replying to the browser: opens a GitHub issue (without
 * names, emails, or the screenshot), emails the team, and sends the person a
 * copy. Anyone can send it; a spam check and a limit of a few an hour keep it sane.
 */
export async function sendFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  // A hidden field people never fill in.
  if (String(formData.get("website") ?? "")) return { error: "Something went wrong. Please try again." };
  const parsed = schema.safeParse({
    kind: formData.get("kind"),
    message: formData.get("message") ?? "",
    page: formData.get("page") ?? "/",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { kind, message, email: typedEmail } = parsed.data;
  const shot = formData.get("screenshot");
  const file = shot instanceof File && shot.size > 0 ? shot : null;
  if (file && (file.size > MAX_SCREENSHOT || !["image/jpeg", "image/png"].includes(file.type))) {
    return { error: "That screenshot didn't work. Try a PNG or JPEG under 4 MB, or send without it." };
  }
  if (!(await passesBotCheck(formData))) return { error: BOT_CHECK_FAILED };

  const user = await getUser();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Who's sending, for the hourly limit: their account, or a one-way fingerprint of their network.
  const senderHash = createHash("sha256")
    .update(`${user?.id ?? ip}:${process.env.SUPABASE_SECRET_KEY ?? ""}`)
    .digest("hex")
    .slice(0, 40);

  const admin = createAdminClient();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error: countError } = await admin
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("sender_hash", senderHash)
    .gte("created_at", since);
  if (isSchemaError(countError)) return { error: "Feedback isn't available right now. Please email us at " + brand.supportEmail + "." };
  if ((count ?? 0) >= FEEDBACK_PER_HOUR) {
    return { error: `Thanks for all the feedback. You can send more in an hour, or email us at ${brand.supportEmail}.` };
  }

  // Who they are, when signed in: their name, and the account they host (if any).
  let name: string | null = null;
  let accountEmail: string | null = null;
  let org: { id: string; name: string; account_kind: string | null; role: string } | null = null;
  if (user) {
    const [{ data: profile }, { data: member }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
      admin
        .from("organization_members")
        .select("role, organizations(id, name, account_kind)")
        .eq("user_id", user.id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);
    name = profile?.full_name?.trim() || null;
    accountEmail = profile?.email ?? user.email ?? null;
    const o = member?.organizations as unknown as { id: string; name: string; account_kind: string | null } | null;
    if (o) org = { ...o, role: member!.role === "owner" ? "Account Host" : "Co-host" };
  }
  const replyTo = accountEmail || typedEmail || null;
  const page = safePagePath(parsed.data.page);
  const userAgent = (h.get("user-agent") ?? "").slice(0, 500);

  const id = randomUUID();
  const screenshotPath = file ? `${id}.${file.type === "image/png" ? "png" : "jpg"}` : null;
  if (file && screenshotPath) {
    const { error: upError } = await admin.storage
      .from(BUCKET)
      .upload(screenshotPath, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (upError) {
      console.error("Saving a feedback screenshot failed", upError);
      return { error: "That screenshot didn't upload. Please try again, or send without it." };
    }
  }
  const { error } = await admin.from("feedback").insert({
    id,
    kind,
    message,
    page,
    user_agent: userAgent || null,
    user_id: user?.id ?? null,
    organization_id: org?.id ?? null,
    name,
    email: replyTo,
    sender_hash: senderHash,
    screenshot_path: screenshotPath,
  });
  if (error) {
    console.error("Saving feedback failed", error);
    return { error: `We couldn't send that. Please try again, or email us at ${brand.supportEmail}.` };
  }

  const origin = await getOrigin();
  const adminUrl = `${origin}/admin/feedback#${id}`;
  const kindLabel = FEEDBACK_KINDS[kind as FeedbackKind].label;
  const who = user
    ? `Signed in${org ? ` · ${org.role}${org.account_kind === "teacher" ? " (teacher account)" : ""}` : ""}`
    : "Not signed in";
  const device = describeDevice(userAgent);

  after(async () => {
    // 1. The GitHub issue: the message, page, and role; never names, emails, or the screenshot.
    const issue = await openGithubIssue({
      title: `${page}: ${message.replace(/\s+/g, " ").slice(0, 70)}${message.length > 70 ? "…" : ""}`,
      body: [
        `**Kind:** ${kindLabel}`,
        `**Page:** \`${page}\``,
        `**Who:** ${who}`,
        `**Device:** ${device}`,
        `**Screenshot:** ${screenshotPath ? "in the admin area" : "none"}`,
        "",
        message
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
        "",
        `Admin: ${adminUrl}`,
      ].join("\n"),
      labels: ["feedback", FEEDBACK_KINDS[kind as FeedbackKind].github],
    });
    if (issue) await admin.from("feedback").update({ github_issue: issue.number, github_url: issue.url }).eq("id", id);

    // 2. The team, right away.
    const from = user ? [name, accountEmail].filter(Boolean).join(" · ") : typedEmail || "No email given";
    const team = emailLayout({
      heading: `Feedback: ${kindLabel}`,
      paragraphs: [message],
      rows: [
        { title: "Page", detail: page },
        { title: "From", detail: `${from}${org ? ` · ${org.name} (${org.role})` : user ? "" : " · Not signed in"}` },
        { title: "Device", detail: device },
        { title: "Screenshot", detail: screenshotPath ? "Yes, open it in the admin area" : "None" },
        { title: "GitHub", detail: issue ? `Issue #${issue.number}: ${issue.url}` : "Not created (no GitHub key set up, or GitHub didn't answer)" },
      ],
      button: { label: "Open in admin", url: adminUrl },
    });
    await notifyAdmins({ subject: `Feedback (${kindLabel}): ${page}`, html: team.html, text: team.text, ...(replyTo ? { replyTo } : {}) });

    // 3. A copy for them, if we have an email.
    if (replyTo) {
      const first = name?.split(/\s+/)[0];
      const copy = emailLayout({
        heading: "We got your feedback",
        paragraphs: [
          `${first ? `Hi ${first}, thanks` : "Thanks"} for telling us. Here's what you sent:`,
          message,
          "We read every message. If we need more details, we'll reply to this email.",
        ],
        footer: `You're receiving this because you sent feedback on ${brand.name}.`,
      });
      if (await sendEmail({ to: replyTo, subject: "We got your feedback", html: copy.html, text: copy.text, replyTo: brand.supportEmail })) {
        await admin.from("feedback").update({ replied_at: new Date().toISOString() }).eq("id", id);
      }
    }
  });

  return { ok: true, sentTo: replyTo };
}

/** "iPhone · Safari", "Windows · Chrome": enough to reproduce a problem. */
function describeDevice(ua: string) {
  if (!ua) return "Unknown";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux"
                : "Other";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /CriOS|Chrome\//.test(ua)
      ? "Chrome"
      : /FxiOS|Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Other";
  return `${os} · ${browser}`;
}

/** For the Feedback form: whether the person is signed in (then we already have their email). */
export async function feedbackWho(): Promise<{ email: string | null }> {
  const user = await getUser();
  return { email: user?.email || null };
}
