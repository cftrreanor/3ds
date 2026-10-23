import "server-only";

// QA comments as GitHub issues (src/app/qa/comment-actions.ts). Needs
// QA_GITHUB_TOKEN (a fine-grained token that can read and write issues on the
// repository) and QA_GITHUB_REPO ("owner/repo"); without them, comments stay on
// the QA site only. docs/QA-SETUP.md has the steps.

const api = () => process.env.QA_GITHUB_API_URL ?? "https://api.github.com";
const repo = () => process.env.QA_GITHUB_REPO ?? "";

export const githubConfigured = () => Boolean(process.env.QA_GITHUB_TOKEN && /^[\w.-]+\/[\w.-]+$/.test(repo()));

/** The issue's page on GitHub. */
export const issueUrl = (n: number) => `https://github.com/${repo()}/issues/${n}`;

/** Marks a GitHub comment that started on the QA site, so it isn't shown twice. */
export const qaMarker = (id: string) => `<!-- qa:${id} -->`;
const MARKER = /<!-- qa:[\w-]+ -->/;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${api()}/repos/${repo()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.QA_GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Labels this server has already made (or found), so each is tried once, not on every comment. */
const madeLabels = new Set<string>();

/** Labels for a reviewer's issues ("qa-comment", "from: Becca"), made the first time. */
async function ensureLabels(author: string) {
  const labels = [
    { name: "qa-comment", color: "b9d3f0", description: "From the QA site" },
    { name: `from: ${author}`.slice(0, 50), color: "0b3558", description: "Who left the QA comment" },
  ];
  await Promise.all(
    labels
      .filter((l) => !madeLabels.has(l.name))
      .map(async (label) => {
        try {
          await call("POST", "/labels", label);
        } catch {
          // Already there (422), or labels aren't allowed: the issue still goes in.
        }
        madeLabels.add(label.name);
      }),
  );
  return labels.map((l) => l.name);
}

export async function createIssue(author: string, title: string, body: string): Promise<number> {
  const labels = await ensureLabels(author);
  const issue = await call<{ number: number }>("POST", "/issues", { title, body, labels });
  return issue.number;
}

export async function addIssueComment(issue: number, body: string): Promise<number> {
  const comment = await call<{ id: number }>("POST", `/issues/${issue}/comments`, { body });
  return comment.id;
}

export async function setIssueOpen(issue: number, open: boolean) {
  await call("PATCH", `/issues/${issue}`, { state: open ? "open" : "closed" });
}

export type GithubReply = { id: number; author: string; body: string; createdAt: string };

/** The issue's state and the replies left on GitHub itself (not the ones copied from the QA site). */
export async function readIssue(issue: number): Promise<{ open: boolean; replies: GithubReply[] }> {
  const [state, comments] = await Promise.all([
    call<{ state: string }>("GET", `/issues/${issue}`),
    call<{ id: number; body: string; created_at: string; user: { login: string } | null }[]>("GET", `/issues/${issue}/comments?per_page=100`),
  ]);
  return {
    open: state.state === "open",
    replies: comments
      .filter((c) => !MARKER.test(c.body ?? ""))
      .map((c) => ({ id: c.id, author: c.user?.login ?? "GitHub", body: c.body, createdAt: c.created_at })),
  };
}
