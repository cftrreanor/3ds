import { createHmac, timingSafeEqual } from "node:crypto";

// The QA site: a private copy of the platform for reviewing pages and copy,
// with its own database and test data (docs/QA-SETUP.md). It's on when the
// deployment sets QA_MODE=1; everywhere else none of this does anything.
//
// Each reviewer has a passcode (QA_REVIEWERS="Becca:passcode,Cleave:passcode").
// Signing in with one sets a cookie naming the reviewer, so the site knows who
// is reviewing, separately from whichever account they're signed in as.

export const isQa = () => process.env.QA_MODE === "1";

/** Who's reviewing (signed cookie), separate from the account they're signed in as. */
export const QA_COOKIE = "fc_qa_reviewer";
export const QA_DAYS = 90;

/** Pages anyone can open on the QA site: the passcode page, robots.txt (which says "stay out"), and the daily job (which checks its own secret). */
export const qaOpenPath = (path: string) => path === "/qa/login" || path === "/robots.txt" || path.startsWith("/api/cron/");

type Reviewer = { name: string; passcode: string };

function reviewers(): Reviewer[] {
  return (process.env.QA_REVIEWERS ?? "")
    .split(",")
    .map((entry) => {
      const at = entry.indexOf(":");
      return { name: entry.slice(0, at).trim(), passcode: entry.slice(at + 1).trim() };
    })
    .filter((r) => r.name && r.passcode.length >= 6);
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** The reviewer this passcode belongs to, or null. */
export function reviewerFor(passcode: string): string | null {
  const typed = passcode.trim();
  return reviewers().find((r) => same(r.passcode, typed))?.name ?? null;
}

const signingKey = () => process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const signature = (payload: string) => createHmac("sha256", signingKey()).update(`qa-reviewer:${payload}`).digest("base64url");

/** The cookie value for a reviewer: their name, when it runs out, and a signature. */
export function signReviewer(name: string) {
  const payload = `${encodeURIComponent(name)}.${Date.now() + QA_DAYS * 86400_000}`;
  return `${payload}.${signature(payload)}`;
}

/**
 * The reviewer a cookie names, if it's genuine, current, and the reviewer is
 * still listed (taking someone out of QA_REVIEWERS locks them out).
 */
export function reviewerFromCookie(cookie: string | undefined): string | null {
  const [name, expires, sig] = (cookie ?? "").split(".");
  if (!name || !expires || !sig || !signingKey() || Number(expires) < Date.now()) return null;
  if (!same(signature(`${name}.${expires}`), sig)) return null;
  const decoded = decodeURIComponent(name);
  return reviewers().some((r) => r.name === decoded) ? decoded : null;
}

/** e.g. becca@qa.fieldcommandevents.com: the reviewer's own QA account (no email is ever sent to it). */
export const reviewerEmail = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reviewer"}@qa.fieldcommandevents.com`;
