"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { getUser } from "@/lib/auth";
import { getOrigin } from "@/lib/data";
import { getDemoState, personaLabel } from "@/lib/demo";
import { QA_COOKIE, isQa, reviewerEmail, reviewerFromCookie } from "@/lib/qa";
import {
  addIssueComment,
  createIssue,
  githubConfigured,
  issueIsOpen,
  issueUrl,
  qaMarker,
  readIssue,
  setIssueOpen,
  type GithubReply,
} from "@/lib/qa-github";
import { createAdminClient } from "@/lib/supabase/server";

// Comments on QA pages (supabase/migrations/20261216000000_qa_comments.sql),
// each also a GitHub issue when QA_GITHUB_TOKEN is set (src/lib/qa-github.ts).

export type Anchor = { selector?: string; fx?: number; fy?: number; px?: number; py?: number; text?: string };

export type Pin = { id: string; author: string; body: string; anchor: Anchor; status: "open" | "resolved"; createdAt: string };

export type Reply = { id: string; author: string; body: string; createdAt: string; onGithub?: boolean };

export type Thread = Pin & {
  path: string;
  viewingAs: string | null;
  screen: string | null;
  hasScreenshot: boolean;
  resolvedBy: string | null;
  replies: Reply[];
  issue: { number: number; url: string } | null;
  githubReady: boolean;
};

type Result<T> = ({ ok: true } & T) | { error: string };

/** The reviewer leaving or answering comments (their QA cookie), or why not. */
async function reviewer(): Promise<string | { error: string }> {
  if (!isQa()) return { error: "Comments are only on the QA site." };
  const name = reviewerFromCookie((await cookies()).get(QA_COOKIE)?.value);
  return name ?? { error: "Open the QA site with your passcode first." };
}

/** Who the reviewer is looking at the page as: a demo person, their own QA account, or signed out. */
async function viewingAs(name: string) {
  const user = await getUser();
  if (!user) return "Signed out";
  const demo = await getDemoState();
  if (demo) return `${personaLabel(demo.persona)} (demo)${demo.event ? ` on ${demo.event.name}` : ""}`;
  return user.email === reviewerEmail(name) ? `${name}'s own QA account` : (user.email ?? "Signed in");
}

const clean = (text: unknown) => String(text ?? "").trim().slice(0, 4000);
const pathOnly = (p: unknown) => {
  const s = String(p ?? "/");
  return s.startsWith("/") && !s.startsWith("//") ? s.slice(0, 500) : "/";
};

/** The open and resolved comments on one page, oldest first (for its pins). */
export async function pinsFor(path: string): Promise<Pin[]> {
  if (typeof (await reviewer()) !== "string") return [];
  const { data } = await createAdminClient()
    .from("qa_comments")
    .select("id, author, body, anchor, status, created_at")
    .eq("path", pathOnly(path))
    .order("created_at");
  return (data ?? []).map((c) => ({ id: c.id, author: c.author, body: c.body, anchor: c.anchor as Anchor, status: c.status, createdAt: c.created_at }));
}

/**
 * The page's open comments whose GitHub issue has been closed (say, by a merged fix):
 * resolved here too, so their pins go. Returns their ids.
 */
export async function closedOnGithub(path: string): Promise<string[]> {
  if (typeof (await reviewer()) !== "string" || !githubConfigured()) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("qa_comments")
    .select("id, github_issue")
    .eq("path", pathOnly(path))
    .eq("status", "open")
    .not("github_issue", "is", null)
    .limit(50);
  const checked = await Promise.all(
    (data ?? []).map(async (c) => {
      try {
        return (await issueIsOpen(c.github_issue as number)) ? null : c.id;
      } catch {
        return null; // GitHub didn't answer: leave the pin.
      }
    }),
  );
  const closed = checked.filter((id): id is string => Boolean(id));
  if (closed.length) {
    await admin.from("qa_comments").update({ status: "resolved", resolved_by: "GitHub", resolved_at: new Date().toISOString() }).in("id", closed);
  }
  return closed;
}

/** Leave a comment on a spot on a page; its GitHub issue opens after the reply is sent. */
export async function addComment(input: {
  body: string;
  path: string;
  anchor: Anchor;
  screen: string;
  screenshot: string | null;
}): Promise<Result<{ id: string }>> {
  const name = await reviewer();
  if (typeof name !== "string") return name;
  const body = clean(input.body);
  if (!body) return { error: "Type your comment first." };
  // A JPEG of the screen, kept small (about 1.5 MB at most).
  const screenshot = input.screenshot?.startsWith("data:image/jpeg;base64,") && input.screenshot.length < 2_000_000 ? input.screenshot : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qa_comments")
    .insert({
      author: name,
      body,
      path: pathOnly(input.path),
      anchor: input.anchor ?? {},
      viewing_as: await viewingAs(name),
      screen: String(input.screen ?? "").slice(0, 40) || null,
      screenshot,
    })
    .select("id, path, viewing_as, screen")
    .single();
  if (error || !data) {
    console.error("Saving the QA comment failed", error);
    return { error: `We couldn't save your comment. Please try again. (Details: ${error?.message ?? "unknown"})` };
  }
  // GitHub takes a few round trips: do them once the reviewer has their answer.
  after(() => toGithub(data.id));
  return { ok: true, id: data.id };
}

/** Open the comment's GitHub issue, if GitHub is connected and it hasn't one yet. */
async function toGithub(id: string): Promise<string | null> {
  if (!githubConfigured()) return "GitHub isn't connected yet (docs/QA-SETUP.md).";
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("qa_comments")
    .select("id, author, body, path, anchor, viewing_as, screen, github_issue, screenshot")
    .eq("id", id)
    .maybeSingle();
  if (!c) return "That comment is gone.";
  if (c.github_issue) return null;
  const origin = await getOrigin();
  const page = `${origin}${c.path}`;
  const firstLine = c.body.split("\n")[0];
  const title = `QA: ${firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine}`;
  const anchor = (c.anchor ?? {}) as Anchor;
  const lines = [
    `**${c.author}** commented on [${c.path}](${page}?qaComment=${c.id})`,
    "",
    c.body
      .split("\n")
      .map((l: string) => `> ${l}`)
      .join("\n"),
    "",
    `- Viewing as: ${c.viewing_as ?? "unknown"}`,
    `- Screen: ${c.screen ?? "unknown"}`,
    ...(anchor.text ? [`- Near: "${anchor.text}"`] : []),
    ...(anchor.selector ? [`- Element: \`${anchor.selector}\``] : []),
    ...(c.screenshot ? [`- Screenshot: ${origin}/qa/comments/${c.id}/screenshot (needs a QA passcode)`] : []),
    "",
    "Reply here or on the QA page; resolving one closes the other.",
    qaMarker(c.id),
  ];
  try {
    const number = await createIssue(c.author, title, lines.join("\n"));
    await admin.from("qa_comments").update({ github_issue: number }).eq("id", c.id);
    return null;
  } catch (err) {
    console.error("Opening the QA comment's GitHub issue failed", err);
    return "GitHub didn't take it. Check the GitHub key in the QA site's settings (docs/QA-SETUP.md).";
  }
}

/** Try GitHub again for a comment that didn't make it there. */
export async function sendToGithub(id: string): Promise<Result<object>> {
  const name = await reviewer();
  if (typeof name !== "string") return name;
  const problem = await toGithub(id);
  return problem ? { error: problem } : { ok: true };
}

/** One comment with its replies, from the QA site and (unless `github` is false, for a quick first look) from GitHub. */
export async function loadThread(id: string, github = true): Promise<Result<{ thread: Thread }>> {
  const name = await reviewer();
  if (typeof name !== "string") return name;
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("qa_comments")
    .select("id, author, body, anchor, status, created_at, path, viewing_as, screen, resolved_by, github_issue, has_screenshot:screenshot")
    .eq("id", id)
    .maybeSingle();
  if (!c) return { error: "That comment is gone." };
  const { data: rows } = await admin.from("qa_comment_replies").select("id, author, body, created_at").eq("comment_id", id).order("created_at");
  const replies: Reply[] = (rows ?? []).map((r) => ({ id: r.id, author: r.author, body: r.body, createdAt: r.created_at }));

  let status = c.status as "open" | "resolved";
  if (github && c.github_issue && githubConfigured()) {
    try {
      const issue = await readIssue(c.github_issue);
      replies.push(...issue.replies.map((r: GithubReply) => ({ id: `gh-${r.id}`, author: r.author, body: r.body, createdAt: r.createdAt, onGithub: true })));
      replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      // Closed on GitHub (say, with the fix): resolved here too, and the other way round.
      const resolvedThere = !issue.open;
      if (resolvedThere !== (status === "resolved")) {
        status = resolvedThere ? "resolved" : "open";
        await admin
          .from("qa_comments")
          .update({ status, resolved_by: resolvedThere ? "GitHub" : null, resolved_at: resolvedThere ? new Date().toISOString() : null })
          .eq("id", id);
      }
    } catch (err) {
      console.error("Reading the QA comment's GitHub issue failed", err);
    }
  }
  return {
    ok: true,
    thread: {
      id: c.id,
      author: c.author,
      body: c.body,
      anchor: c.anchor as Anchor,
      status,
      createdAt: c.created_at,
      path: c.path,
      viewingAs: c.viewing_as,
      screen: c.screen,
      hasScreenshot: Boolean(c.has_screenshot),
      resolvedBy: status === "resolved" ? (c.resolved_by ?? "GitHub") : null,
      replies,
      issue: c.github_issue ? { number: c.github_issue, url: issueUrl(c.github_issue) } : null,
      githubReady: githubConfigured(),
    },
  };
}

/** Answer a comment; the reply goes to its GitHub issue too, after the reviewer has their answer. */
export async function replyTo(id: string, text: string): Promise<Result<{ reply: Reply }>> {
  const name = await reviewer();
  if (typeof name !== "string") return name;
  const body = clean(text);
  if (!body) return { error: "Type your reply first." };
  const admin = createAdminClient();
  const { data: c } = await admin.from("qa_comments").select("github_issue").eq("id", id).maybeSingle();
  if (!c) return { error: "That comment is gone." };
  const { data: reply, error } = await admin
    .from("qa_comment_replies")
    .insert({ comment_id: id, author: name, body })
    .select("id, created_at")
    .single();
  if (error || !reply) return { error: `We couldn't save your reply. (Details: ${error?.message ?? "unknown"})` };
  const issue = c.github_issue;
  if (issue && githubConfigured()) {
    after(async () => {
      try {
        const ghId = await addIssueComment(issue, `**${name}** replied on the QA site:\n\n${body}\n\n${qaMarker(reply.id)}`);
        await admin.from("qa_comment_replies").update({ github_comment: ghId }).eq("id", reply.id);
      } catch (err) {
        console.error("Copying the QA reply to GitHub failed", err);
      }
    });
  }
  return { ok: true, reply: { id: reply.id, author: name, body, createdAt: reply.created_at } };
}

/** Resolve or reopen a comment, and close or reopen its GitHub issue. */
export async function setResolved(id: string, resolved: boolean): Promise<Result<object>> {
  const name = await reviewer();
  if (typeof name !== "string") return name;
  const admin = createAdminClient();
  const { data: c, error } = await admin
    .from("qa_comments")
    .update({ status: resolved ? "resolved" : "open", resolved_by: resolved ? name : null, resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", id)
    .select("github_issue")
    .maybeSingle();
  if (error || !c) return { error: "We couldn't update that comment. Please try again." };
  const issue = c.github_issue;
  if (issue && githubConfigured()) {
    after(async () => {
      try {
        await setIssueOpen(issue, !resolved);
      } catch (err) {
        console.error("Updating the QA comment's GitHub issue failed", err);
      }
    });
  }
  return { ok: true };
}
