import "server-only";

/** The kinds of feedback, as the form and the GitHub labels name them. */
export const FEEDBACK_KINDS = {
  bug: { label: "Something's broken", github: "bug" },
  idea: { label: "Idea", github: "idea" },
  question: { label: "Question", github: "question" },
} as const;
export type FeedbackKind = keyof typeof FEEDBACK_KINDS;

/** How many times one person (or network) can send feedback in an hour. */
export const FEEDBACK_PER_HOUR = 5;

/**
 * The page someone was on, safe to share: just the path, with private links
 * (volunteer passes, invitations, calendar and manage links) replaced by
 * ":link" so a GitHub issue never carries someone's access.
 */
export function safePagePath(raw: string) {
  let path = "/";
  try {
    path = new URL(raw, "https://example.com").pathname;
  } catch {
    // Keep "/".
  }
  return path
    .split("/")
    .map((part) => (/^[0-9a-f-]{20,}$/i.test(part) || part.length > 40 ? ":link" : part))
    .join("/")
    .slice(0, 300);
}

/**
 * Opens a GitHub issue for a piece of feedback. Needs GITHUB_FEEDBACK_TOKEN
 * (a fine-grained token that can only create issues in the repository) and,
 * optionally, GITHUB_FEEDBACK_REPO ("owner/repo"). Without the token it does
 * nothing; the feedback is still saved and emailed. Never throws.
 */
export async function openGithubIssue(issue: { title: string; body: string; labels: string[] }) {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO || "cftrreanor/3ds";
  if (!token) return null;
  const post = (labels: string[]) =>
    fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: issue.title, body: issue.body, ...(labels.length ? { labels } : {}) }),
    });
  try {
    let res = await post(issue.labels);
    // A token that can't add labels still opens the issue.
    if (res.status === 422 || res.status === 403) res = await post([]);
    if (!res.ok) {
      console.error("Opening a GitHub issue for feedback failed", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { number: number; html_url: string };
    return { number: data.number, url: data.html_url };
  } catch (err) {
    console.error("Opening a GitHub issue for feedback failed", err);
    return null;
  }
}
