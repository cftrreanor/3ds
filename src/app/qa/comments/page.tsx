import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { HeaderBar } from "@/components/logo";
import { Card } from "@/components/ui";
import { isQa } from "@/lib/qa";
import { githubConfigured, issueUrl } from "@/lib/qa-github";
import { isSchemaError, missing } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "QA comments" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

const chip = (on: boolean) =>
  `inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium ${on ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface hover:border-brand"}`;

/** Every comment on the QA site, by person and open or resolved (src/app/qa/comment-actions.ts). */
export default async function QaCommentsPage({ searchParams }: PageProps<"/qa/comments">) {
  await connection(); // Read fresh on every visit, never at build time.
  if (!isQa()) redirect("/");
  const { who, status } = await searchParams;
  const person = typeof who === "string" ? who : "";
  const state = status === "resolved" || status === "all" ? status : "open";

  const admin = createAdminClient();
  const { data: everyone, error } = await admin.from("qa_comments").select("author");
  if (isSchemaError(error)) missing();
  const people = [...new Set((everyone ?? []).map((c) => c.author))].sort();

  let query = admin
    .from("qa_comments")
    .select("id, created_at, author, body, path, status, viewing_as, github_issue")
    .order("created_at", { ascending: false })
    .limit(300);
  if (person) query = query.eq("author", person);
  if (state !== "all") query = query.eq("status", state);
  const { data: comments } = await query;

  const href = (p: { who?: string; status?: string }) => {
    const q = new URLSearchParams();
    const w = p.who ?? person;
    const s = p.status ?? state;
    if (w) q.set("who", w);
    if (s !== "open") q.set("status", s);
    const qs = q.toString();
    return `/qa/comments${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <HeaderBar maxWidth="max-w-4xl" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-12">
        <h1 className="text-4xl font-medium tracking-tight">Comments</h1>
        <p className="mt-2 text-muted">
          Every comment left on the QA site. Open one to see it on its page.
          {githubConfigured() ? " Each is also a GitHub issue." : " GitHub isn't connected yet, so they stay here for now."}
        </p>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Whose comments">
          <Link href={href({ who: "" })} className={chip(!person)} aria-current={!person ? "page" : undefined}>
            Everyone
          </Link>
          {people.map((p) => (
            <Link key={p} href={href({ who: p })} className={chip(person === p)} aria-current={person === p ? "page" : undefined}>
              {p}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Open or resolved">
          {(["open", "resolved", "all"] as const).map((s) => (
            <Link key={s} href={href({ status: s })} className={chip(state === s)} aria-current={state === s ? "page" : undefined}>
              {s === "open" ? "Open" : s === "resolved" ? "Resolved" : "All"}
            </Link>
          ))}
        </div>

        {!comments?.length ? (
          <Card className="mt-8">
            <p className="font-medium">No comments here</p>
            <p className="mt-1 text-sm text-muted">On any QA page, tap Comment, then the spot you want to comment on.</p>
          </Card>
        ) : (
          <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
            {comments.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <Link href={`${c.path}${c.path.includes("?") ? "&" : "?"}qaComment=${c.id}`} className="block hover:text-brand">
                  <span className="line-clamp-2 font-medium">{c.body}</span>
                </Link>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="font-semibold text-foreground">{c.author}</span>
                  <span>{c.path}</span>
                  {c.viewing_as && <span>as {c.viewing_as}</span>}
                  <span className="tabular-nums">{when(c.created_at)}</span>
                  {c.status === "resolved" && <span className="font-semibold text-success">Resolved</span>}
                  {c.github_issue && (
                    <a href={issueUrl(c.github_issue)} className="text-brand underline underline-offset-2" target="_blank" rel="noreferrer">
                      Issue #{c.github_issue}
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
