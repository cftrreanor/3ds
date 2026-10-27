import "server-only";
import { isHexColor } from "@/lib/brand-color";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";

export const LOGO_BUCKET = "org-logos";
export const LOGO_TYPES = ["image/png", "image/jpeg"] as const;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** One line of a badge's schedule: a shift, or a station they lead. */
export type BadgeRow = { key: string; when: string | null; station: string; place: string | null; lead: boolean; sort: string };

export type Badge = { key: string; first: string; last: string; rows: BadgeRow[] };

export type BadgeFilters = { station?: string; day?: string };

/**
 * A volunteer's name as worn on a badge. Under-18 helpers show a first name
 * and last initial only ("Maya R."), since badges are worn in public.
 */
export function badgeName(fullName: string, minor: boolean): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const rest = parts.slice(1);
  if (minor) return { first, last: rest.length ? `${rest[rest.length - 1][0].toUpperCase()}.` : "" };
  return { first, last: rest.join(" ") };
}

type Station = { id: string; name: string; location: string | null };
type Shift = { id: string; station_id: string; title: string; starts_at: string; ends_at: string };
type Assignment = {
  shift_id: string;
  volunteers: { id: string; full_name: string; email: string | null; minor: boolean } | null;
};
type StaffRow = { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | null };

/**
 * Everyone who gets a badge: each volunteer with their whole schedule, and
 * each Sign-up Lead (marked "Station Lead" only on the sign-ups they lead,
 * whether or not they also signed up for shifts). Sorted by last name.
 * Filters pick who gets a badge (a station or a day); a badge always shows
 * the person's full schedule.
 */
export async function loadBadges(
  eventId: string,
  tz: string,
  multiDay: boolean,
  filters: BadgeFilters,
): Promise<Badge[]> {
  const supabase = await createClient();
  const [{ data: stationData }, { data: shiftData }, { data: assignmentData }, { data: leadData }, { data: staffData }] = await Promise.all([
    supabase.from("stations").select("id, name, location").eq("event_id", eventId),
    supabase.from("shifts").select("id, station_id, title, starts_at, ends_at").eq("event_id", eventId),
    supabase
      .from("volunteer_assignments")
      .select("shift_id, volunteers(id, full_name, email, minor), shifts!inner(event_id)")
      .eq("shifts.event_id", eventId),
    supabase.from("station_leads").select("station_id, user_id").eq("event_id", eventId),
    supabase.from("event_staff").select("user_id, role, profiles(full_name, email)").eq("event_id", eventId),
  ]);
  const stations = new Map(((stationData ?? []) as Station[]).map((s) => [s.id, s]));
  const shifts = new Map(((shiftData ?? []) as Shift[]).map((s) => [s.id, s]));
  const staff = (staffData ?? []) as unknown as StaffRow[];
  const email = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

  // Which stations each lead (by email) leads.
  const leadsByEmail = new Map<string, { name: string; stations: Set<string> }>();
  for (const l of (leadData ?? []) as { station_id: string; user_id: string }[]) {
    const p = staff.find((s) => s.user_id === l.user_id)?.profiles;
    const key = email(p?.email);
    if (!key) continue;
    const entry = leadsByEmail.get(key) ?? { name: p?.full_name?.trim() || "", stations: new Set<string>() };
    entry.stations.add(l.station_id);
    leadsByEmail.set(key, entry);
  }

  const shiftRow = (sh: Shift, lead: boolean): BadgeRow => {
    const st = stations.get(sh.station_id);
    const day = multiDay ? `${formatDate(utcToZonedDate(sh.starts_at, tz), { year: undefined })} · ` : "";
    return {
      key: sh.id,
      when: `${day}${formatTimeRange(sh.starts_at, sh.ends_at, tz, { zone: false })}`,
      station: st?.name ?? sh.title,
      place: st?.location ?? null,
      lead,
      sort: sh.starts_at,
    };
  };
  const leadRow = (stationId: string): BadgeRow => {
    const st = stations.get(stationId);
    return { key: `lead-${stationId}`, when: null, station: st?.name ?? "Sign-up", place: st?.location ?? null, lead: true, sort: "" };
  };
  const matches = (shiftIds: string[], led: Set<string>) => {
    if (filters.station && !led.has(filters.station) && !shiftIds.some((id) => shifts.get(id)?.station_id === filters.station)) return false;
    if (filters.day && !shiftIds.some((id) => {
      const sh = shifts.get(id);
      return sh && utcToZonedDate(sh.starts_at, tz) === filters.day;
    })) return false;
    return true;
  };

  // Volunteers, with each of their shifts.
  const people = new Map<string, { name: string; minor: boolean; email: string; shiftIds: string[] }>();
  for (const a of (assignmentData ?? []) as unknown as Assignment[]) {
    const v = a.volunteers;
    if (!v || !shifts.has(a.shift_id)) continue;
    const p = people.get(v.id) ?? { name: v.full_name, minor: v.minor, email: email(v.email), shiftIds: [] };
    p.shiftIds.push(a.shift_id);
    people.set(v.id, p);
  }

  const badges: Badge[] = [];
  const leadsWithBadge = new Set<string>();
  for (const [id, p] of people) {
    const led = (p.email && leadsByEmail.get(p.email)?.stations) || new Set<string>();
    if (p.email && led.size) leadsWithBadge.add(p.email);
    if (!matches(p.shiftIds, led)) continue;
    const rows = p.shiftIds.map((sid) => shiftRow(shifts.get(sid)!, led.has(shifts.get(sid)!.station_id)));
    // A station they lead without a shift there still shows, marked Station Lead (listed first).
    for (const stationId of led) if (!rows.some((r) => r.lead && shifts.get(r.key)?.station_id === stationId)) rows.push(leadRow(stationId));
    badges.push({ key: id, ...badgeName(p.name, p.minor), rows: rows.sort((x, y) => Number(!!x.sort) - Number(!!y.sort) || x.sort.localeCompare(y.sort)) });
  }
  // Sign-up Leads who didn't sign up for a shift: their sign-ups.
  for (const [key, l] of leadsByEmail) {
    if (leadsWithBadge.has(key) || !l.name) continue;
    if (filters.station && !l.stations.has(filters.station)) continue;
    badges.push({ key: `lead-${key}`, ...badgeName(l.name, false), rows: [...l.stations].map(leadRow) });
  }
  return badges.sort((a, b) => (a.last || a.first).localeCompare(b.last || b.first) || a.first.localeCompare(b.first));
}

/**
 * The account's logo as an inline image (data URL) and its color, or nulls.
 * Read by our server only. Works before the color's database update too.
 */
export async function loadBrand(organizationId: string): Promise<{ logo: string | null; color: string | null }> {
  const admin = createAdminClient();
  const withColor = await admin.from("organizations").select("logo_path, brand_color").eq("id", organizationId).maybeSingle();
  const org = withColor.error
    ? (await admin.from("organizations").select("logo_path").eq("id", organizationId).maybeSingle()).data
    : withColor.data;
  const row = org as { logo_path: string | null; brand_color?: string | null } | null;
  const color = isHexColor(row?.brand_color) ? row.brand_color : null;
  if (!row?.logo_path) return { logo: null, color };
  const { data: file } = await admin.storage.from(LOGO_BUCKET).download(row.logo_path);
  if (!file) return { logo: null, color };
  const type = file.type && (LOGO_TYPES as readonly string[]).includes(file.type) ? file.type : "image/png";
  return { logo: `data:${type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`, color };
}

/** The account's logo as an inline image (data URL), or null. */
export async function loadLogo(organizationId: string): Promise<string | null> {
  return (await loadBrand(organizationId)).logo;
}
