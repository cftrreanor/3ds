import { freeStatus } from "@/lib/admin";
import { utcToZonedDate } from "@/lib/time";

// Shared pieces of the admin CRM (src/app/admin): pipeline stages, account
// health, relative times, table sorting and timeline entries.

/** Admin pages show times in the company's own time zone. */
export const ADMIN_TZ = "America/Chicago";

/** Pilot pipeline stages, in order. Declined sits outside the flow. */
export const STAGES = [
  { value: "new", label: "New", hint: "Just asked to join" },
  { value: "contacted", label: "Contacted", hint: "We've been in touch" },
  { value: "invited", label: "Invited", hint: "Host invitation sent" },
  { value: "set_up", label: "Set up", hint: "Organization created" },
  { value: "active", label: "Active", hint: "Published an event" },
  { value: "declined", label: "Declined", hint: "Not going ahead" },
] as const;
export type Stage = (typeof STAGES)[number]["value"];
export const isStage = (v: unknown): v is Stage => STAGES.some((s) => s.value === v);
export const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;

const DAY = 864e5;
const days = (iso: string, now: number) => Math.floor((now - Date.parse(iso)) / DAY);

/** "just now", "5 min ago", "3 h ago", "yesterday", "12 days ago", "Mar 4, 2026". */
export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "Never";
  const mins = Math.round((now - Date.parse(iso)) / 60000);
  if (mins < 0) {
    const ahead = -mins;
    if (ahead < 60 * 24) return "today";
    const d = Math.round(ahead / 1440);
    return d === 1 ? "tomorrow" : `in ${d} days`;
  }
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} h ago`;
  const d = Math.floor(mins / 1440);
  if (d === 1) return "yesterday";
  if (d < 60) return `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: ADMIN_TZ });
}

/** "Mar 4, 2:05 PM" in the admin time zone. */
export function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: ADMIN_TZ,
  });
}

export type HealthLevel = "good" | "new" | "watch" | "risk";
export const HEALTH_LABEL: Record<HealthLevel, string> = { good: "Healthy", new: "New", watch: "Watch", risk: "At risk" };
export const HEALTH_ORDER: Record<HealthLevel, number> = { risk: 0, watch: 1, new: 2, good: 3 };

/**
 * How an account is doing, with the reasons, from what the dashboard already
 * knows: the plan, events, and when its hosts last signed in.
 */
export function accountHealth(
  org: { subscription_status: string; free_until: string | null; default_timezone: string; created_at: string },
  events: { status: string; starts_on: string; ends_on: string }[],
  lastHostSignIn: string | null,
  now = Date.now(),
): { level: HealthLevel; reasons: string[] } {
  const risk: string[] = [];
  const watch: string[] = [];
  const age = days(org.created_at, now);
  const today = utcToZonedDate(new Date(now).toISOString(), org.default_timezone);
  const free = freeStatus(org);

  if (org.subscription_status === "past_due") risk.push("Payment is late");
  if (org.subscription_status === "canceled") risk.push("Plan canceled");
  if (free?.ended) risk.push(free.text);
  else if (free?.soon) watch.push(free.text);

  const signedInDaysAgo = lastHostSignIn ? days(lastHostSignIn, now) : null;
  if (age > 14 && (signedInDaysAgo === null || signedInDaysAgo > 45)) {
    risk.push(signedInDaysAgo === null ? "No host has signed in" : `No host sign-in for ${signedInDaysAgo} days`);
  }

  const published = events.filter((e) => e.status === "published");
  const upcoming = published.filter((e) => e.ends_on >= today);
  if (events.length === 0) {
    if (age > 14) watch.push("No events yet");
  } else if (published.length === 0) {
    if (age > 30) watch.push("Nothing published yet");
  } else if (upcoming.length === 0) {
    const last = published.map((e) => e.ends_on).sort().at(-1)!;
    if (days(`${last}T12:00:00Z`, now) > 60) watch.push("No upcoming events");
  }

  if (risk.length) return { level: "risk", reasons: [...risk, ...watch] };
  if (watch.length) return { level: "watch", reasons: watch };
  if (age <= 14) return { level: "new", reasons: ["Joined in the last two weeks"] };
  return { level: "good", reasons: upcoming.length ? ["Upcoming event published"] : ["Active and up to date"] };
}

/** Supabase audit-log actions, in plain words (unknown ones pass through). */
export function authActionLabel(action: string) {
  return (
    {
      login: "Signed in",
      logout: "Signed out",
      user_signedup: "Created their account",
      user_confirmation_requested: "Asked for a sign-in link (new account)",
      user_recovery_requested: "Asked for a sign-in link",
      user_reauthenticate_requested: "Asked for a confirmation code",
      user_updated_password: "Changed their password",
      user_modified: "Updated their account",
      user_invited: "Was invited",
      user_deleted: "Account deleted",
      identity_unlinked: "Unlinked a sign-in method",
    }[action] ?? action.replaceAll("_", " ")
  );
}

export const ROLE_FILTERS = [
  { value: "host", label: "Hosts" },
  { value: "team", label: "Event teams" },
  { value: "director", label: "Directors" },
  { value: "none", label: "No role yet" },
] as const;
export const ROLE_LABEL: Record<string, string> = { host: "Host", team: "Event team", director: "Director" };

/** A person's roles across the app: host (organization member), event team, band or group director. */
export function personRoles(p: { organization_members: unknown[]; event_staff: unknown[]; bands: unknown[] }) {
  const roles: string[] = [];
  if (p.organization_members.length) roles.push("host");
  if (p.event_staff.length) roles.push("team");
  if (p.bands.length) roles.push("director");
  return roles;
}

/** Sorting a table from ?sort=&dir= with per-column accessors. */
export function sortBy<T>(rows: T[], key: string, dir: string, columns: Record<string, (r: T) => string | number | null>) {
  const get = columns[key];
  if (!get) return rows;
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === y) return 0;
    if (x === null) return 1; // blanks last either way
    if (y === null) return -1;
    return (x < y ? -1 : 1) * sign;
  });
}

/** One line in an account's or person's timeline. */
export type TimelineItem = {
  at: string;
  kind: "note" | "email" | "signin" | "event" | "admin" | "pipeline" | "account";
  title: string;
  detail?: string | null;
  /** The full text of an email written in the admin dashboard. */
  body?: string | null;
  href?: string;
  tone?: "danger" | "warning" | "success";
  note?: { id: string; followUpOn: string | null; done: boolean; author: string | null };
};

export const byNewest = (a: TimelineItem, b: TimelineItem) => b.at.localeCompare(a.at);
