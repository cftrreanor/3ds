import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/admin";
import { stamp } from "@/lib/admin-crm";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/lib/feedback";
import { isSchemaError } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";
import { EmptyRow, PageHeader, RecordLink, Table, Tag, Td, Th, Tr } from "../kit";

export const metadata: Metadata = { title: "Feedback" };

type Row = {
  id: string;
  created_at: string;
  kind: FeedbackKind;
  message: string;
  page: string;
  user_agent: string | null;
  name: string | null;
  email: string | null;
  screenshot_path: string | null;
  github_issue: number | null;
  github_url: string | null;
  replied_at: string | null;
  organizations: { id: string; name: string; account_kind: string | null } | null;
};

const TONES = { bug: "danger", idea: "brand", question: "neutral" } as const;

/** Everything sent from the Feedback button, newest first, with screenshots and GitHub issues. */
export default async function AdminFeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  await requirePlatformAdmin();
  const { kind } = await searchParams;
  const only = typeof kind === "string" && kind in FEEDBACK_KINDS ? (kind as FeedbackKind) : null;
  const admin = createAdminClient();
  let query = admin
    .from("feedback")
    .select("id, created_at, kind, message, page, user_agent, name, email, screenshot_path, github_issue, github_url, replied_at, organizations(id, name, account_kind)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (only) query = query.eq("kind", only);
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];
  // Screenshots are private: a link that works for an hour.
  const paths = rows.map((r) => r.screenshot_path).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length
    ? await admin.storage.from("feedback-screenshots").createSignedUrls(paths, 3600)
    : { data: [] };
  const shotUrl = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <div>
      <PageHeader
        title="Feedback"
        sub="Everything sent from the Feedback button on every page, newest first. Each one is also emailed to you and opened as a GitHub issue."
      />
      <div className="mb-4 flex flex-wrap gap-1">
        {[null, ...Object.keys(FEEDBACK_KINDS)].map((k) => (
          <a
            key={k ?? "all"}
            href={k ? `/admin/feedback?kind=${k}` : "/admin/feedback"}
            aria-current={only === k ? "page" : undefined}
            className={`rounded-sm px-2 py-1 text-sm ${only === k ? "bg-brand-soft font-semibold" : "text-muted hover:text-foreground"}`}
          >
            {k ? FEEDBACK_KINDS[k as FeedbackKind].label : "All"}
          </a>
        ))}
      </div>
      {isSchemaError(error) ? (
        <p className="mt-4 text-sm text-muted">A database update is needed first: run 20270103000000_feedback.sql (see the setup guide).</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>From</Th>
              <Th>Kind</Th>
              <Th>Page</Th>
              <Th>Message</Th>
              <Th>Screenshot</Th>
              <Th>Issue</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id} className="has-[:target]:bg-brand-soft">
                <Td className="scroll-mt-16 whitespace-nowrap text-muted" id={r.id}>
                  {stamp(r.created_at)}
                </Td>
                <Td>
                  <p>{r.name || r.email || <span className="text-muted">Anonymous</span>}</p>
                  {r.name && r.email && <p className="text-xs text-muted">{r.email}</p>}
                  {r.organizations && (
                    <p className="text-xs">
                      <RecordLink href={`/admin/accounts/${r.organizations.id}`}>{r.organizations.name}</RecordLink>
                      {r.organizations.account_kind === "teacher" ? " · Teacher" : ""}
                    </p>
                  )}
                  {r.replied_at && <p className="text-xs text-muted">Copy sent</p>}
                </Td>
                <Td>
                  <Tag tone={TONES[r.kind]}>{FEEDBACK_KINDS[r.kind].label}</Tag>
                </Td>
                <Td className="font-mono text-xs break-all">{r.page}</Td>
                <Td className="max-w-md whitespace-pre-wrap">{r.message}</Td>
                <Td>
                  {r.screenshot_path && shotUrl.get(r.screenshot_path) ? (
                    <a href={shotUrl.get(r.screenshot_path) ?? undefined} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                      View
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {r.github_url ? (
                    <a href={r.github_url} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                      #{r.github_issue}
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow cols={7}>Nothing yet. Feedback from the button on every page shows up here.</EmptyRow>}
          </tbody>
        </Table>
      )}
    </div>
  );
}
