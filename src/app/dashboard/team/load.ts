import "server-only";
import { getMyOrganization } from "@/lib/data";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { REMOVED_RECENTLY_DAYS } from "@/lib/team-words";
import { utcToZonedDate } from "@/lib/time";

// Everything My team shows, worked out once (docs/design-lessons.md, L1). What each person
// may read is limited by the database; this only arranges it.

export type StaffRole = "volunteer_director" | "section_lead";
export type Profile = { full_name: string; email: string; phone: string | null };
export type TeamEvent = { id: string; name: string; starts_on: string; ends_on: string; timezone: string; ended: boolean };

/** One role someone has on one event. */
export type RoleOn = {
  event: TeamEvent;
  role: StaffRole;
  /** The jobs they lead (Coordinators). */
  jobs: string[];
  /** Jobs nobody else leads: they'll need a new Coordinator. */
  soleJobs: string[];
  /** The event's only Volunteer Lead. */
  soleLead: boolean;
};
export type Person = { userId: string; profile: Profile; roles: RoleOn[] };
export type Invite = {
  id: string;
  email: string;
  role: StaffRole | null;
  asHost: boolean;
  event: TeamEvent | null;
  job: string | null;
  link: string;
  sentAt: string | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
};
export type Removal = {
  id: string;
  role: "co_host" | StaffRole;
  email: string;
  name: string;
  event: TeamEvent | null;
  removedAt: string;
  left: boolean;
};
export type Spots = { used: number; invited: number; max: number | null; plan: string | null; eventStaff: boolean };
export type Host = { userId: string; role: "owner" | "admin"; profile: Profile };
/** Your own role on someone else's event (or your own, as a Volunteer Lead or Coordinator). */
export type MyRole = RoleOn & { accountHost: { name: string; email: string } | null };

export type HostView = {
  kind: "host";
  org: { id: string; name: string };
  isAccountHost: boolean;
  accountHost: Host | null;
  hosts: Host[];
  coHostInvites: Invite[];
  /** Volunteer Leads and Coordinators on events that aren't over. */
  people: Person[];
  /** Invitations to events that aren't over. */
  eventInvites: Invite[];
  /** Helpers whose events are all over: they don't hold a spot. */
  past: Person[];
  removed: Removal[];
  /** Events that aren't over, for adding people. */
  upcoming: TeamEvent[];
  spots: Spots;
};
export type LeadView = {
  kind: "lead";
  /** Events where you're a Volunteer Lead, with their Coordinators. */
  events: { event: TeamEvent; coordinators: Person[]; invites: Invite[] }[];
  removed: Removal[];
};
export type MyTeam = { me: string; host: HostView | null; lead: LeadView | null; myRoles: MyRole[] };

type EventRow = { id: string; name: string; starts_on: string; ends_on: string; timezone: string };
type StaffRow = { user_id: string; role: StaffRole; event_id: string; profiles: Profile | null };
type LeadRow = { user_id: string; event_id: string; stations: { name: string } | null };
type InviteRow = {
  id: string;
  email: string;
  role: StaffRole | null;
  as_host: boolean;
  event_id: string | null;
  token: string;
  created_at: string;
  sent_at: string | null;
  expires_at: string;
  stations: { name: string } | null;
};
type RemovalRow = {
  id: string;
  role: "co_host" | StaffRole;
  user_id: string;
  email: string;
  full_name: string;
  removed_by: string | null;
  removed_at: string;
  event_id: string | null;
};

const NO_PROFILE: Profile = { full_name: "", email: "", phone: null };
export const personName = (p: Profile) => p.full_name || p.email || "Team member";

/** Over once its last day has passed where it's held. */
function toEvent(e: EventRow): TeamEvent {
  const today = utcToZonedDate(new Date().toISOString(), e.timezone || "America/Chicago");
  return { ...e, ended: e.ends_on < today };
}

const byStart = (a: { event: TeamEvent }, b: { event: TeamEvent }) => a.event.starts_on.localeCompare(b.event.starts_on);
const byName = (a: Person, b: Person) => personName(a.profile).localeCompare(personName(b.profile));

/** Each person once, with every role they have, and what removing them would leave empty. */
function groupPeople(staff: StaffRow[], leads: LeadRow[], events: Map<string, TeamEvent>): Person[] {
  const people = new Map<string, Person>();
  for (const s of staff) {
    const event = events.get(s.event_id);
    if (!event) continue;
    const jobs = s.role === "section_lead" ? leads.filter((l) => l.user_id === s.user_id && l.event_id === s.event_id).map((l) => l.stations?.name ?? "") : [];
    const soleJobs = jobs.filter((job) => leads.filter((l) => l.event_id === s.event_id && l.stations?.name === job).length === 1);
    const soleLead = s.role === "volunteer_director" && staff.filter((o) => o.event_id === s.event_id && o.role === "volunteer_director").length === 1;
    const person = people.get(s.user_id) ?? { userId: s.user_id, profile: s.profiles ?? NO_PROFILE, roles: [] };
    person.roles.push({ event, role: s.role, jobs: jobs.filter(Boolean), soleJobs: soleJobs.filter(Boolean), soleLead });
    people.set(s.user_id, person);
  }
  for (const p of people.values()) p.roles.sort(byStart);
  return [...people.values()].sort(byName);
}

function toInvite(i: InviteRow, events: Map<string, TeamEvent>, origin: string): Invite {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    asHost: i.as_host,
    event: i.event_id ? (events.get(i.event_id) ?? null) : null,
    job: i.stations?.name ?? null,
    link: `${origin}/invite/${i.token}`,
    sentAt: i.sent_at,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
    expired: new Date(i.expires_at) < new Date(),
  };
}

/** Removed in the last 90 days, and not back on the team or invited again. */
function recentRemovals(rows: RemovalRow[], events: Map<string, TeamEvent>, back: (r: RemovalRow) => boolean): Removal[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => !back(r))
    .filter((r) => {
      // One row per person and role (the newest).
      const key = `${r.user_id}:${r.role}:${r.event_id ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({
      id: r.id,
      role: r.role,
      email: r.email,
      name: r.full_name || r.email,
      event: r.event_id ? (events.get(r.event_id) ?? null) : null,
      removedAt: r.removed_at,
      left: r.removed_by === r.user_id,
    }));
}

const removedSince = () => new Date(Date.now() - REMOVED_RECENTLY_DAYS * 86_400_000).toISOString();

export async function loadMyTeam(userId: string, origin: string): Promise<MyTeam> {
  const supabase = await createClient();
  const [org, { data: mine }] = await Promise.all([
    getMyOrganization(),
    supabase
      .from("event_staff")
      .select("role, event_id, events(id, name, starts_on, ends_on, timezone, organization_id)")
      .eq("user_id", userId),
  ]);
  const myStaff = (mine ?? []) as unknown as { role: StaffRole; event_id: string; events: (EventRow & { organization_id: string }) | null }[];

  const { data: membership } = org
    ? await supabase.from("organization_members").select("role").eq("organization_id", org.id).eq("user_id", userId).maybeSingle()
    : { data: null };
  const host = org && membership ? await loadHostView(org, userId, origin) : null;

  // Events where you're the Volunteer Lead (and not already a host of them).
  const ledEvents = myStaff
    .filter((s) => s.role === "volunteer_director" && s.events && s.events.organization_id !== host?.org.id)
    .map((s) => toEvent(s.events!))
    .filter((e) => !e.ended);
  const lead = ledEvents.length ? await loadLeadView(ledEvents, origin) : null;

  // Your own roles on events outside your account: you can leave them here.
  const outside = myStaff.filter((s) => s.events && s.events.organization_id !== host?.org.id);
  const owners = await accountHosts([...new Set(outside.map((s) => s.events!.organization_id))]);
  const myRoles: MyRole[] = outside
    .map((s) => {
      const event = toEvent(s.events!);
      return { event, role: s.role, jobs: [], soleJobs: [], soleLead: false, accountHost: owners.get(s.events!.organization_id) ?? null };
    })
    .filter((r) => !r.event.ended)
    .sort(byStart);

  return { me: userId, host, lead, myRoles };
}

async function loadHostView(org: { id: string; name: string }, userId: string, origin: string): Promise<HostView> {
  const supabase = await createClient();
  const [{ data: memberData }, { data: eventData }, { data: inviteData }, { data: removalData }, { data: spotData }] = await Promise.all([
    supabase.from("organization_members").select("user_id, role, profiles(full_name, email, phone)").eq("organization_id", org.id).order("created_at"),
    supabase.from("events").select("id, name, starts_on, ends_on, timezone").eq("organization_id", org.id).order("starts_on"),
    supabase
      .from("invitations")
      .select("id, email, role, as_host, event_id, token, created_at, sent_at, expires_at, stations(name)")
      .eq("organization_id", org.id)
      .is("accepted_at", null)
      .order("created_at"),
    supabase
      .from("team_removals")
      .select("id, role, user_id, email, full_name, removed_by, removed_at, event_id")
      .eq("organization_id", org.id)
      .gte("removed_at", removedSince())
      .order("removed_at", { ascending: false }),
    supabase.rpc("team_spots", { p_org: org.id }),
  ]);
  const events = new Map(((eventData ?? []) as EventRow[]).map((e) => [e.id, toEvent(e)]));
  const ids = [...events.keys()];
  const [{ data: staffData }, { data: leadData }] = ids.length
    ? await Promise.all([
        supabase.from("event_staff").select("user_id, role, event_id, profiles(full_name, email, phone)").in("event_id", ids).order("created_at"),
        supabase.from("station_leads").select("user_id, event_id, stations(name)").in("event_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const staff = (staffData ?? []) as unknown as StaffRow[];
  const leads = (leadData ?? []) as unknown as LeadRow[];

  const hosts = ((memberData ?? []) as unknown as { user_id: string; role: "owner" | "admin"; profiles: Profile | null }[])
    .map((m) => ({ userId: m.user_id, role: m.role, profile: m.profiles ?? NO_PROFILE }))
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  const accountHost = hosts.find((h) => h.role === "owner") ?? null;

  const current = groupPeople(staff.filter((s) => !events.get(s.event_id)?.ended), leads, events);
  const onTeam = new Set(current.map((p) => p.userId));
  const past = groupPeople(staff.filter((s) => events.get(s.event_id)?.ended && !onTeam.has(s.user_id)), leads, events);

  const invites = ((inviteData ?? []) as unknown as InviteRow[]).map((i) => toInvite(i, events, origin));
  const coHostInvites = invites.filter((i) => i.asHost);
  const eventInvites = invites.filter((i) => !i.asHost && i.event && !i.event.ended);

  const invited = new Set(invites.map((i) => i.email.toLowerCase()));
  const removed = recentRemovals((removalData ?? []) as RemovalRow[], events, (r) =>
    invited.has(r.email.toLowerCase()) ||
    (r.role === "co_host" ? hosts.some((h) => h.userId === r.user_id) : staff.some((s) => s.user_id === r.user_id && s.event_id === r.event_id && s.role === r.role)),
  );

  const s = (spotData ?? {}) as { used?: number; invited?: number; max?: number | null; plan?: string | null; event_staff?: boolean };
  return {
    kind: "host",
    org: { id: org.id, name: org.name },
    isAccountHost: accountHost?.userId === userId,
    accountHost,
    hosts,
    coHostInvites,
    people: current,
    eventInvites,
    past,
    removed,
    upcoming: [...events.values()].filter((e) => !e.ended),
    spots: { used: s.used ?? hosts.length, invited: s.invited ?? 0, max: s.max ?? null, plan: s.plan ?? null, eventStaff: s.event_staff ?? true },
  };
}

async function loadLeadView(ledEvents: TeamEvent[], origin: string): Promise<LeadView> {
  const supabase = await createClient();
  const ids = ledEvents.map((e) => e.id);
  const events = new Map(ledEvents.map((e) => [e.id, e]));
  const [{ data: staffData }, { data: leadData }, { data: inviteData }, { data: removalData }] = await Promise.all([
    supabase.from("event_staff").select("user_id, role, event_id, profiles(full_name, email, phone)").in("event_id", ids).eq("role", "section_lead").order("created_at"),
    supabase.from("station_leads").select("user_id, event_id, stations(name)").in("event_id", ids),
    supabase
      .from("invitations")
      .select("id, email, role, as_host, event_id, token, created_at, sent_at, expires_at, stations(name)")
      .in("event_id", ids)
      .eq("role", "section_lead")
      .is("accepted_at", null)
      .order("created_at"),
    // Volunteer Leads see removed Coordinators only (the database's rule).
    supabase
      .from("team_removals")
      .select("id, role, user_id, email, full_name, removed_by, removed_at, event_id")
      .in("event_id", ids)
      .gte("removed_at", removedSince())
      .order("removed_at", { ascending: false }),
  ]);
  const staff = (staffData ?? []) as unknown as StaffRow[];
  const leads = (leadData ?? []) as unknown as LeadRow[];
  const invites = ((inviteData ?? []) as unknown as InviteRow[]).map((i) => toInvite(i, events, origin));
  const invited = new Set(invites.map((i) => i.email.toLowerCase()));
  return {
    kind: "lead",
    events: ledEvents
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
      .map((event) => ({
        event,
        coordinators: groupPeople(
          staff.filter((s) => s.event_id === event.id),
          leads,
          events,
        ),
        invites: invites.filter((i) => i.event?.id === event.id),
      })),
    removed: recentRemovals((removalData ?? []) as RemovalRow[], events, (r) =>
      invited.has(r.email.toLowerCase()) || staff.some((s) => s.user_id === r.user_id && s.event_id === r.event_id && s.role === r.role),
    ),
  };
}

/**
 * Who to ask about an account: its Account Host's name and email, for the people on its
 * event teams (who can't read the account's members themselves).
 */
async function accountHosts(orgIds: string[]) {
  const map = new Map<string, { name: string; email: string }>();
  if (!orgIds.length) return map;
  const { data } = await createAdminClient()
    .from("organization_members")
    .select("organization_id, profiles(full_name, email)")
    .in("organization_id", orgIds)
    .eq("role", "owner");
  for (const row of (data ?? []) as unknown as { organization_id: string; profiles: { full_name: string; email: string } | null }[]) {
    if (row.profiles) map.set(row.organization_id, { name: row.profiles.full_name || row.profiles.email, email: row.profiles.email });
  }
  return map;
}

/** Whether to show My team in the menu: hosts, co-hosts, and anyone on an event's team. */
export async function hasTeamPage(userId: string) {
  const supabase = await createClient();
  const [members, staff] = await Promise.all([
    supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("event_staff").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return (members.count ?? 0) + (staff.count ?? 0) > 0;
}
