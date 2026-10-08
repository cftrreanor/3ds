import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";

/**
 * For every admin page and action: a FieldCommand admin (platform_admins), or
 * "not found". Pages load with the server's key after this check.
 */
export async function requirePlatformAdmin() {
  const user = await requireUser();
  const { data, error } = await (await createClient()).rpc("is_platform_admin");
  if (error) missing();
  if (!data) notFound();
  return user;
}

/** The plans, in the words the dashboard uses. Pilot and Trial have a last free day. */
export const PLANS = [
  { value: "comped", label: "Pilot (free)", free: true },
  { value: "trialing", label: "Trial", free: true },
  { value: "active", label: "Paid", free: false },
  { value: "past_due", label: "Paid · payment late", free: false },
  { value: "canceled", label: "Canceled", free: false },
  { value: "none", label: "No plan", free: false },
] as const;
export type PlanStatus = (typeof PLANS)[number]["value"];

export const planLabel = (status: string) => PLANS.find((p) => p.value === status)?.label ?? status;
export const isFreePlan = (status: string) => PLANS.some((p) => p.value === status && p.free);

/** Default last day for a new pilot: the end of the 2026–27 school year. */
export const DEFAULT_PILOT_END = "2027-06-30";

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5);

/** Where a pilot or trial stands: "Free through Jun 30, 2027", "Ends in 12 days", "Ended Jun 30, 2027". */
export function freeStatus(org: { subscription_status: string; free_until: string | null; default_timezone: string }) {
  if (!isFreePlan(org.subscription_status) || !org.free_until) return null;
  const today = utcToZonedDate(new Date().toISOString(), org.default_timezone);
  const left = daysBetween(today, org.free_until);
  const day = formatDate(org.free_until, { weekday: undefined });
  if (left < 0) return { ended: true, soon: false, left, day, text: `Free period ended ${day}` };
  if (left <= 30)
    return { ended: false, soon: true, left, day, text: left === 0 ? "Free period ends today" : `Free period ends in ${left} day${left === 1 ? "" : "s"}` };
  return { ended: false, soon: false, left, day, text: `Free through ${day}` };
}

export type AdminLogRow = {
  id: string;
  action: string;
  details: { from?: { status: string; free_until: string | null }; to?: { status: string; free_until: string | null }; note?: string | null };
  created_at: string;
  admin: { full_name: string; email: string } | null;
  organization: { name: string } | null;
};

export const ADMIN_LOG_COLUMNS =
  "id, action, details, created_at, admin:profiles!admin_log_admin_id_fkey(full_name, email), organization:organizations!admin_log_organization_id_fkey(name)";

const planWithEnd = (p?: { status: string; free_until: string | null }) =>
  p ? `${planLabel(p.status)}${p.free_until ? ` through ${formatDate(p.free_until, { weekday: undefined })}` : ""}` : "?";

/** "Pilot (free) through Jun 30, 2027 → Paid" */
export function describeAdminLog(r: AdminLogRow) {
  if (r.action === "plan_changed") return `Plan: ${planWithEnd(r.details.from)} → ${planWithEnd(r.details.to)}`;
  return r.action;
}
