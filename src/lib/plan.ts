// Packages and event passes (20261223000000_packages.sql). The database holds the
// limits (plan_tiers) and enforces them; this file loads an account's plan
// summary (account_plan) and says it in plain words.

import type { SupabaseClient } from "@supabase/supabase-js";

export const PACKAGES = [
  { value: "free", label: "Free" },
  { value: "schedule", label: "Schedule Command" },
  { value: "volunteer", label: "Volunteer Command" },
  { value: "event", label: "Event Command" },
  { value: "district", label: "District Command" },
] as const;
export type PackageCode = (typeof PACKAGES)[number]["value"];
export const isPackage = (v: unknown): v is PackageCode => PACKAGES.some((p) => p.value === v);
export const packageLabel = (code: string) => PACKAGES.find((p) => p.value === code)?.label ?? code;

/** What the account pays at. It changes no features. */
export const RATES = [
  { value: "standard", label: "Standard rate" },
  { value: "teacher", label: "Teacher rate" },
] as const;
export const isRate = (v: unknown): v is "standard" | "teacher" => RATES.some((r) => r.value === v);
export const rateLabel = (code: string) => RATES.find((r) => r.value === code)?.label ?? code;

/** One-time passes: one published event of a type the package doesn't include. List prices match plan_tiers. */
export const PASSES = [
  { type: "school_visit", label: "School visitor day", cents: 5000 },
  { type: "volunteer", label: "Volunteer event", cents: 7500 },
  { type: "fair", label: "School fair", cents: 10000 },
  { type: "group_event", label: "Group event", cents: 12500 },
  { type: "band_contest", label: "Band contest", cents: 15000 },
] as const;
export const passFor = (type: string) => PASSES.find((p) => p.type === type);

/** Each kind of event, in the words used in plan messages (event_type_words in the database). */
const TYPE_WORDS: Record<string, string> = {
  conference: "parent-teacher conferences",
  meeting: "meetings",
  volunteer: "volunteer events",
  school_visit: "school visitor events",
  fair: "school fairs",
  group_event: "group events",
  band_contest: "band contests",
};
export const typeWords = (type: string) => TYPE_WORDS[type] ?? type;
const TYPE_ORDER = Object.keys(TYPE_WORDS);

export const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;

/** account_plan(): what the account's package includes and what it's using. */
export type AccountPlan = {
  package: string;
  package_name: string;
  /** The package it publishes under now: Free while a paid package's plan isn't active. */
  active: string;
  active_name: string;
  rate: string;
  event_types: string[];
  own_event_types: string[];
  one_at_a_time: string[];
  weekly_hours: boolean;
  /** Null is unlimited. */
  max_team: number | null;
  event_staff: boolean;
  volunteer_history: boolean;
  /** The Volunteer tracking page shows: the package includes it, or it did before a downgrade and there's history. */
  volunteer_tracking: boolean;
  team: number;
  published: Record<string, number>;
  passes_unused: Record<string, number>;
  pass_total_cents: number;
};

/** The account's plan, or null before the database update (or for someone who can't see it). */
export async function loadAccountPlan(supabase: SupabaseClient, orgId: string): Promise<AccountPlan | null> {
  const { data, error } = await supabase.rpc("account_plan", { p_org: orgId });
  if (error) {
    if (error.code !== "42501") console.error("account_plan failed", error.message);
    return null;
  }
  return data as AccountPlan;
}

/** Event types it can start: its package's own, plus any it holds an unused pass for. */
export function startableTypes(plan: AccountPlan): string[] {
  const unused = Object.entries(plan.passes_unused)
    .filter(([, n]) => n > 0)
    .map(([t]) => t);
  return [...new Set([...plan.own_event_types, ...unused])];
}

const sortTypes = (types: string[]) => [...types].sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b));

/** "a, b, and c" */
export function listWords(words: string[]) {
  if (words.length <= 2) return words.join(" and ");
  return `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`;
}

/** What the package includes, in plain words, one line each. */
export function includedLines(plan: AccountPlan): string[] {
  const all = plan.own_event_types.length >= TYPE_ORDER.length;
  const lines = [
    all ? "Every kind of event" : capitalize(listWords(sortTypes(plan.own_event_types).map(typeWords))),
    ...sortTypes(plan.one_at_a_time).map((t) => `One published ${typeWords(t).replace(/s$/, "")} at a time, with as many drafts as you like`),
    plan.weekly_hours ? "Weekly hours for conferences and meetings" : "Conferences and meetings on set days (weekly hours aren't included)",
    plan.max_team === null
      ? "A team of any size, including Volunteer Leads and Sign-up Leads"
      : `A team of up to ${plan.max_team} people${plan.max_team === 2 ? " (a host and a co-host)" : ""}${plan.event_staff ? ", including Volunteer Leads and Sign-up Leads" : ""}`,
    plan.volunteer_history ? "Volunteer tracking across your events" : "Volunteer tracking isn't included",
  ];
  return lines;
}

/** Usage against the limits: "Volunteer events published: 1 of 1", "Team: 2 of 2". */
export function usageLines(plan: AccountPlan): string[] {
  const lines = sortTypes(plan.one_at_a_time).map((t) => `${capitalize(typeWords(t))} published: ${plan.published[t] ?? 0} of 1`);
  lines.push(plan.max_team === null ? `Team: ${plan.team}` : `Team: ${plan.team} of ${plan.max_team}`);
  for (const t of sortTypes(Object.keys(plan.passes_unused))) {
    const n = plan.passes_unused[t];
    if (n > 0) lines.push(`Unused ${passFor(t)?.label.toLowerCase() ?? typeWords(t)} pass${n === 1 ? "" : "es"}: ${n}`);
  }
  return lines;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
