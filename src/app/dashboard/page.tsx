import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { registrationIsOpen } from "@/lib/bands";
import { getMyOrganization, type Organization } from "@/lib/data";
import { freeStatus } from "@/lib/admin";
import { brand } from "@/lib/brand";
import { conferenceBookedCount } from "@/lib/conference-access";
import { createClient } from "@/lib/supabase/server";
import { invitedAs } from "@/lib/invited-as";
import { formatDate, formatDateRange, formatTime, utcToZonedDate, zoneAbbreviation } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { DayStatusPill } from "@/components/day-status";
import { eventPhase, type BandDay } from "@/lib/contest-day";
import { bandSteps, dayStatus, groupSteps, type DayStatus, type ProgressRow } from "@/lib/director-day";
import { eventTypeLabel, groupWords, hasConferences, hasEnsembles, hasRooms } from "@/lib/event-types";
import type { createClient as CreateClient } from "@/lib/supabase/server";
import { RequestAccess } from "@/components/request-access";
import { OnboardingForm } from "./onboarding-form";
import { LockIcon, NewEventButton } from "@/components/event-type-picker";
import { endedSentence, loadAccountPlan, pickerSubtitle, planEnded, spotTaken, startableTypes, typeNotes } from "@/lib/plan";
import { setupChecklist, type SetupChecklist, type SetupFacts } from "@/lib/setup-checklist";
import { loadSetupFacts } from "@/lib/setup-facts";
import { SuccessToast } from "@/components/toaster";

export const metadata: Metadata = { title: "My events" };

type EventSummary = {
  id: string;
  name: string;
  status: string;
  timezone: string;
  starts_on: string;
  ends_on: string;
  venue_name: string | null;
  venue_address: string;
  event_type: string | null;
  organization_id: string;
};

type MyBand = {
  id: string;
  band_name: string;
  school_name: string;
  events:
    | (EventSummary & {
        band_registration_open: boolean;
        band_registration_deadline: string | null;
        performance_order_published: boolean;
        finalists_revealed: boolean;
        ready_minutes_before: number;
        finals_ready_minutes_before: number;
      })
    | null;
  // Only readable once the host publishes, so these double as "times are posted".
  performance_slots: { perform_at: string | null } | { perform_at: string | null }[] | null;
  finals_slots: { perform_at: string | null }[];
};

type DraftStatus = { checklist: SetupChecklist; planBlock: SetupFacts["planBlock"]; planActive: boolean; pass: boolean };

/** How many drafts on My events show their next step (each reads that event's setup). */
const MAX_DRAFT_STEPS = 6;

type StaffEvent = { role: "volunteer_director" | "section_lead"; events: EventSummary | null };

const EVENT_COLUMNS = "id, organization_id, name, status, timezone, starts_on, ends_on, venue_name, venue_address, event_type";

/** Has the event ended, in its own time zone? */
function isPast(e: { ends_on: string; timezone: string }) {
  return e.ends_on < utcToZonedDate(new Date().toISOString(), e.timezone);
}

/** Is it on today, in its own time zone? */
function isToday(e: { starts_on: string; ends_on: string; timezone: string }) {
  const today = utcToZonedDate(new Date().toISOString(), e.timezone);
  return e.starts_on <= today && today <= e.ends_on;
}

/**
 * Where a host goes on the day, by event type: the first job in the event-day bar
 * (src/lib/event-day-actions.ts), with the same words. Keep the two in step.
 */
const DAY_SCREEN: Record<string, { path: string; label: string }> = {
  band_contest: { path: "contest-day", label: "Check on every band" },
  group_event: { path: "event-day", label: "Check groups in" },
  school_visit: { path: "parents/check-in", label: "Check in parents" },
  conference: { path: "conferences/meetings", label: "Run today's meetings" },
  fair: { path: "booths/check-in", label: "Check in booths and partners" },
  volunteer: { path: "volunteers", label: "Check in volunteers" },
};

/** Who has signed up so far, per event: the one number each kind of event runs on. */
async function signupCounts(supabase: Awaited<ReturnType<typeof CreateClient>>, events: EventSummary[]) {
  const ids = (match: (t: string | null) => boolean) => events.filter((e) => match(e.event_type)).map((e) => e.id);
  const tally = async (table: string, eventIds: string[], onlyActive = false) => {
    if (!eventIds.length) return [] as { event_id: string }[];
    let q = supabase.from(table).select("event_id").in("event_id", eventIds);
    if (onlyActive) q = q.is("scratched_at", null);
    return ((await q).data ?? []) as { event_id: string }[];
  };
  const rows = (
    await Promise.all([
      tally("bands", ids(hasEnsembles), true),
      tally("parent_registrations", ids((t) => t === "school_visit")),
      // Bookings are the teacher's alone; other hosts on the account get the count.
      Promise.all(
        ids(hasConferences).map(async (id) => Array.from({ length: await conferenceBookedCount(supabase, id) }, () => ({ event_id: id }))),
      ).then((r) => r.flat()),
      tally("fair_booths", ids((t) => t === "fair")),
      tally("volunteers", ids((t) => t === "volunteer")),
    ])
  ).flat();
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  return counts;
}

function signupLine(type: string | null, n: number) {
  const plural = (one: string, many: string) => (n === 1 ? one : many);
  if (hasEnsembles(type)) {
    const w = groupWords(type);
    return n ? `${n} ${plural(w.one, w.many)} registered` : `No ${w.many} registered yet`;
  }
  if (type === "school_visit") return n ? `${n} ${plural("family", "families")} registered` : "No families registered yet";
  if (hasConferences(type)) return n ? `${n} ${plural("meeting", "meetings")} booked` : "No meetings booked yet";
  if (type === "fair") return n ? `${n} ${plural("booth", "booths")} added` : "No booths added yet";
  return n ? `${n} ${plural("volunteer", "volunteers")} signed up` : "No volunteers signed up yet";
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { deleted, withdrawn } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [org, { data: orgRows }, { data: staffRows }, { data: bandRows }] = await Promise.all([
    getMyOrganization(),
    // Every organization you host or co-host (RLS shows only your own).
    supabase.from("organizations").select("id, name").order("created_at"),
    supabase.from("event_staff").select(`role, events(${EVENT_COLUMNS})`).eq("user_id", user.id),
    supabase
      .from("bands")
      .select(
        `id, band_name, school_name,
         events(${EVENT_COLUMNS}, band_registration_open, band_registration_deadline, performance_order_published, finalists_revealed, ready_minutes_before, finals_ready_minutes_before),
         performance_slots(perform_at), finals_slots(perform_at)`,
      )
      .eq("director_user_id", user.id),
  ]);
  const myBands = ((bandRows ?? []) as unknown as MyBand[])
    .filter((b): b is MyBand & { events: NonNullable<MyBand["events"]> } => b.events != null)
    .sort((a, b) => a.events.starts_on.localeCompare(b.events.starts_on) || a.band_name.localeCompare(b.band_name));
  // On the day: each band's status at a glance (on track, coming up, running late).
  const now = new Date();
  const live = new Map(
    (
      await Promise.all(
        myBands
          .filter((b) => b.events.performance_order_published && eventPhase(b.events, now) === "day")
          .map(async (b) => [b.id, await liveStatus(b, now)] as const),
      )
    ).filter((x): x is readonly [string, DayStatus] => x[1] != null),
  );
  const helping = ((staffRows ?? []) as unknown as StaffEvent[])
    .filter((r): r is StaffEvent & { events: EventSummary } => r.events != null)
    .sort((a, b) => a.events.starts_on.localeCompare(b.events.starts_on));

  // FieldCommand staff: a way in to the pilot requests from the home page.
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  // New hosts are invited by FieldCommand (has_host_invitation); admins can always set one up.
  const mayHost = !org && (Boolean(isAdmin) || (await supabase.rpc("has_host_invitation")).data === true);
  const newRequests = isAdmin
    ? ((await supabase.from("pilot_requests").select("id", { count: "exact", head: true }).eq("status", "new")).count ?? 0)
    : 0;

  const orgs = orgRows ?? [];
  const hosted = orgs.length
    ? ((
        await supabase
          .from("events")
          .select(EVENT_COLUMNS)
          .in("organization_id", orgs.map((o) => o.id))
          .order("starts_on", { ascending: true })
      ).data ?? []) as EventSummary[]
    : [];

  // Today's events first, then the rest by date.
  hosted.sort((a, b) => Number(isToday(b)) - Number(isToday(a)));
  const counts = await signupCounts(
    supabase,
    hosted.filter((e) => e.status === "published" && !isPast(e)),
  );
  const mixedHosted = new Set(hosted.map((e) => e.event_type)).size > 1;
  const mixedHelping = new Set(helping.map((r) => r.events.event_type)).size > 1;
  // A director's bands at the same contest share one card.
  const byEvent = new Map<string, DirectorBand[]>();
  for (const b of myBands) byEvent.set(b.events.id, [...(byEvent.get(b.events.id) ?? []), b]);
  const bandsByEvent = [...byEvent.values()];

  if (!org && helping.length === 0 && myBands.length === 0) {
    // People who only volunteer belong on their shifts page, not host setup.
    const { count } = await supabase.from("volunteers").select("id", { count: "exact", head: true });
    if (count) redirect("/my");
    return (
      <div className={`mx-auto ${mayHost ? "max-w-lg" : "max-w-2xl"}`}>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          {mayHost ? "Welcome. Let's set up your account" : `Welcome to ${brand.name}`}
        </h1>
        {mayHost ? (
          <>
            <p className="mt-2 leading-7 text-muted">A few details, then you can create your first event. You can invite co-hosts later.</p>
            <Card className="mt-8">
              <OnboardingForm {...(await invitedAs(user.email))} />
            </Card>
          </>
        ) : (
          <div className="mt-8">
            <RequestAccess email={user.email} />
          </div>
        )}
        <p className="mt-6 text-sm text-muted">
          Registering a band for someone else&apos;s contest? Use the registration link the host sent you.
        </p>
      </div>
    );
  }

  const teacher = org?.account_kind === "teacher";
  // New event leads with the package's kinds plus any with an unused pass; any other kind can be tried.
  const plan = org ? await loadAccountPlan(supabase, org.id) : null;
  const included = plan ? startableTypes(plan) : teacher ? ["conference"] : undefined;
  const ownEvents = org ? hosted.filter((e) => e.organization_id === org.id) : [];
  // One sentence for what ended (a free pilot or trial, or a lapsed plan), used by the notice and the picker.
  const ended = org ? endedSentence(plan, freeStatus(org), org.subscription_status) : null;
  const newEvent = (
    <NewEventButton
      included={included}
      notes={plan ? typeNotes(plan, ownEvents) : undefined}
      subtitle={pickerSubtitle(plan, included, ended)}
      lead={plan && planEnded(plan) ? "conference" : undefined}
    />
  );
  // Each upcoming draft's next step, from the same checklist as its event page. Only the
  // soonest few: each one reads the event's setup, and the rest open on their own page.
  const drafts = new Map(
    (
      await Promise.all(
        ownEvents
          .filter((e) => e.status === "draft" && !isPast(e))
          .slice(0, MAX_DRAFT_STEPS)
          .map(async (e) => {
            const facts = await loadSetupFacts(e.id);
            return facts ? ([e.id, { checklist: setupChecklist(facts), planBlock: facts.planBlock ?? null, planActive: plan ? !planEnded(plan) : true,
                // Publishable only thanks to an unused pass (which the first one published uses).
                pass: Boolean(plan && !facts.planBlock && e.event_type && !plan.event_types.includes(e.event_type)) }] as const) : null;
          }),
      )
    ).filter((x) => x != null),
  );
  // Who can renew the plan: the Account Host, or ask them. Only when there's something to say.
  const accountHost = org && (ended || freeStatus(org)?.soon) ? await loadAccountHost(supabase, org.id, user.id) : null;
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">My events</h1>
        {deleted && <SuccessToast message="Event deleted." />}
        {withdrawn && <SuccessToast message="Registration withdrawn. The organizer has been emailed." />}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2 text-sm hover:border-brand/40"
          >
            <span className="font-semibold">Admin</span>
            <span className="whitespace-nowrap text-muted">
              {newRequests ? `${newRequests} new pilot request${newRequests === 1 ? "" : "s"} →` : "Open admin →"}
            </span>
          </Link>
        )}
      </div>
      {org && (
        <Section
          icon={teacher ? "🍎" : "🏟️"}
          title={teacher ? "Your conferences" : "Hosting"}
          description={
            teacher
              ? "Parent-teacher conferences you're running. Free during the pilot."
              : `Events ${orgs.length > 1 ? orgs.map((o) => o.name).join(" and ") : org.name} ${orgs.length > 1 ? "are" : "is"} putting on.`
          }
          action={newEvent}
          notice={org && <PlanNotice org={org} ended={ended} spot={plan ? spotTaken(plan, ownEvents) : null} accountHost={accountHost} />}
          items={hosted.map((e) => ({
            key: e.id,
            past: isPast(e),
            node: <HostedCard event={e} showType={mixedHosted} signups={counts.get(e.id) ?? 0} draft={drafts.get(e.id)} />,
          }))}
          empty={
            <Card className="text-center">
              <h3 className="font-semibold">{teacher ? "No conferences yet" : "No events yet"}</h3>
              <p className="mx-auto mt-2 max-w-md leading-7 text-muted">
                {teacher
                  ? "Set up your first conference. Families can book once you publish it."
                  : "Create your first event. It stays a private draft until you publish it, so you can set everything up at your own pace."}
              </p>
              <div className="mt-4">
                {newEvent}
              </div>
            </Card>
          }
          nothingUpcoming={
            <Card className="text-center">
              <h3 className="font-semibold">{teacher ? "No upcoming conferences" : "No upcoming events"}</h3>
              <p className="mx-auto mt-2 max-w-md leading-7 text-muted">Your past ones are below.</p>
              <div className="mt-4">
                {newEvent}
              </div>
            </Card>
          }
        />
      )}

      {live.size > 0 && <AutoRefresh seconds={30} />}
      {myBands.length > 0 && (
        <Section
          icon="🎺"
          title="Competing"
          description="Your bands' registrations at contests."
          items={bandsByEvent.map((bands) => ({
            key: bands[0].events.id,
            past: isPast(bands[0].events),
            node: <BandCard bands={bands} live={live} />,
          }))}
        />
      )}

      {helping.length > 0 && (
        <Section
          icon="🙋"
          title="Helping run"
          description="Events where you're on the host's team."
          items={helping.map((r) => ({
            key: `${r.events.id}-${r.role}`,
            past: isPast(r.events),
            node: <HelpingCard row={r} showType={mixedHelping} />,
          }))}
        />
      )}

      {!org && <HostYourOwn invited={mayHost} />}
    </div>
  );
}

/** A role's section: upcoming cards up top, past ones folded away underneath. */
function Section({
  icon,
  title,
  description,
  action,
  notice,
  items,
  empty,
  nothingUpcoming,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
  /** A note under the heading, e.g. when a free pilot ends. */
  notice?: ReactNode;
  items: { key: string; past: boolean; node: ReactNode }[];
  empty?: ReactNode;
  /** Shown when everything is in the past. */
  nothingUpcoming?: ReactNode;
}) {
  const upcoming = items.filter((i) => !i.past);
  const past = items.filter((i) => i.past);
  const grid = (list: typeof items) => (
    <ul className="grid gap-4 sm:grid-cols-2">
      {list.map((i) => (
        <li key={i.key}>{i.node}</li>
      ))}
    </ul>
  );
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            <span aria-hidden="true">{icon}</span> {title}
          </h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {action}
      </div>
      {notice && <div className="mt-4">{notice}</div>}
      <div className="mt-4">
        {upcoming.length > 0
          ? grid(upcoming)
          : items.length === 0 && empty
            ? empty
            : (nothingUpcoming ?? <p className="text-sm text-muted">Nothing coming up.</p>)}
      </div>
      {past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
            Past ({past.length})
          </summary>
          <div className="mt-4">{grid(past)}</div>
        </details>
      )}
    </section>
  );
}

/**
 * Every dashboard card has the same shape: the name (which opens it) with a
 * small badge for where things stand or your role, the date and place, then
 * what's next at the bottom.
 */
function EventCard({
  title,
  href,
  badge,
  event: e,
  showType,
  highlight,
  children,
}: {
  title: string;
  /** The whole card opens this, when set. */
  href?: string;
  badge?: ReactNode;
  event: EventSummary;
  showType?: boolean;
  highlight?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card className={`relative h-full transition ${href ? "hover:border-brand" : ""} ${highlight ? "border-brand ring-1 ring-brand" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">
          {href ? (
            <Link href={href} className="after:absolute after:inset-0 after:rounded-lg">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        {badge}
      </div>
      {showType && (
        <p className="mt-2">
          <Badge tone="info">{eventTypeLabel(e.event_type)}</Badge>
        </p>
      )}
      <p className="mt-2 text-sm text-muted">
        {formatDateRange(e.starts_on, e.ends_on)} · {where(e)}
      </p>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

const where = (e: EventSummary) => e.venue_name ?? e.venue_address;

function HostedCard({
  event: e,
  showType,
  signups,
  draft,
}: {
  event: EventSummary;
  showType: boolean;
  signups: number;
  /** Drafts: the setup checklist, for the next step and how far along it is. */
  draft?: DraftStatus;
}) {
  const href = `/dashboard/events/${e.id}`;
  const today = isToday(e) && e.status === "published";
  const day = DAY_SCREEN[e.event_type ?? "band_contest"];
  const past = isPast(e);
  return (
    <EventCard
      title={e.name}
      href={href}
      event={e}
      showType={showType}
      highlight={today}
      badge={
        <Badge tone={e.status === "published" ? "live" : "neutral"}>
          {e.status === "published" ? "Published" : e.status === "archived" ? "Archived" : "Draft"}
        </Badge>
      }
    >
      {past || e.status === "archived" ? null : today && day ? (
        // Above the card's own link, so it can be tapped on its own.
        <Link
          href={`${href}/${day.path}`}
          className="relative z-10 inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
        >
          Today · {day.label} →
        </Link>
      ) : e.status === "published" ? (
        <p className="text-sm font-medium">{signupLine(e.event_type, signups)}</p>
      ) : draft ? (
        <DraftNext draft={draft} />
      ) : (
        <p className="text-sm font-medium">Next: finish setup and publish</p>
      )}
    </EventCard>
  );
}

/** A draft's next step, how far along it is, and anything the plan holds back. */
function DraftNext({ draft: { checklist: c, planBlock, planActive, pass } }: { draft: DraftStatus }) {
  const left = c.progress.of - c.progress.done;
  return (
    <div className="space-y-1 text-sm">
      {c.remaining.length ? (
        <>
          <p className="font-medium">Next: {c.next?.label}</p>
          <p className="text-muted">
            {left} {left === 1 ? "step" : "steps"} left to publish
          </p>
        </>
      ) : (
        <p className={`flex items-center gap-1.5 font-medium ${planBlock ? "" : "text-success"}`}>
          <span aria-hidden>✓</span> {planBlock ? "Setup done" : "Ready to publish"}
        </p>
      )}
      {pass && <p className="text-muted">Publishing uses your event pass</p>}
      {planBlock && (
        <p className="flex items-start gap-1.5 font-medium text-warning">
          <LockIcon />
          {heldBackLine(planBlock, planActive)}
        </p>
      )}
    </div>
  );
}

/** Why the plan holds a draft back, in a few words (the event page has the full reason). */
function heldBackLine(block: NonNullable<SetupFacts["planBlock"]>, planActive: boolean) {
  if (block.other) return `You can publish this after ${block.other.name} ends`;
  if (block.reason.includes("weekly hours")) return "Weekly hours need a plan";
  const kind = block.reason.match(/doesn't include (.+?)\./)?.[1];
  if (planActive && kind) return `Your plan doesn't include ${kind}`;
  return "Publishing needs a plan";
}

/** Where a band stands at a contest, in one line. */
function bandStatus(b: DirectorBand): { text: string; tone: "brand" | "accent" | "neutral" } {
  const e = b.events;
  const at = (iso: string) =>
    `${e.starts_on !== e.ends_on ? `${formatDate(utcToZonedDate(iso, e.timezone), { year: undefined })}, ` : ""}${formatTime(iso, e.timezone)} ${zoneAbbreviation(iso, e.timezone)}`;
  if (isPast(e)) return { text: "Completed", tone: "neutral" };
  const finals = e.finalists_revealed ? b.finals_slots[0] : undefined;
  if (finals) return { text: finals.perform_at ? `🏆 Finalist · performs ${at(finals.perform_at)}` : "🏆 Finalist", tone: "accent" };
  const slot = Array.isArray(b.performance_slots) ? b.performance_slots[0] : b.performance_slots;
  const perform = e.performance_order_published ? slot?.perform_at : null;
  if (perform) return { text: `Performs ${at(perform)}`, tone: "brand" };
  return { text: registrationIsOpen(e) ? "Registered · times not posted yet" : "Registration closed · times not posted yet", tone: "neutral" };
}

/** A band's (or group's) steps today, from the host team's taps. Null when there's nothing to track. */
async function liveStatus(b: DirectorBand, now: Date): Promise<DayStatus | null> {
  const supabase = await createClient();
  const e = b.events;
  const time = (iso: string) => formatTime(iso, e.timezone);
  if (hasRooms(e.event_type)) {
    const [{ data: slots }, { data: rooms }, { data: checkins }] = await Promise.all([
      supabase.from("room_slots").select("room_id, starts_at, ends_at").eq("band_id", b.id),
      supabase.from("rooms").select("id, name, note").eq("event_id", e.id),
      supabase.from("group_checkins").select("room_id, created_at").eq("band_id", b.id),
    ]);
    const steps = groupSteps({ slots: slots ?? [], rooms: new Map((rooms ?? []).map((r) => [r.id, r])), checkins: checkins ?? [], time });
    return steps.length ? dayStatus(steps, now, time) : null;
  }
  const [{ data: day }, { data: prelims }, { data: finals }, { data: rows }] = await Promise.all([
    supabase
      .from("bands")
      .select("id, bus_count, box_truck_count, truck_trailer_count, semi_truck_count, buses_at, equipment_at, equipment_spot, away_at, left_at, scratched_at")
      .eq("id", b.id)
      .maybeSingle(),
    supabase.from("performance_slots").select("warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("band_id", b.id).maybeSingle(),
    e.finalists_revealed
      ? supabase.from("finals_slots").select("warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("band_id", b.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("my_band_progress", { p_band_id: b.id }),
  ]);
  if (!day || day.scratched_at || !prelims || !(rows ?? []).length) return null;
  const { steps } = bandSteps({
    band: day as BandDay,
    rows: rows as ProgressRow[],
    prelims,
    finals,
    readyMinutes: e.ready_minutes_before,
    finalsReadyMinutes: e.finals_ready_minutes_before,
    time,
  });
  return dayStatus(steps, now, time);
}

type DirectorBand = MyBand & { events: NonNullable<MyBand["events"]> };

/** One contest, with a row per band you brought (each opens that band's page). */
function BandCard({ bands, live }: { bands: DirectorBand[]; live: Map<string, DayStatus> }) {
  const e = bands[0].events;
  const one = bands.length === 1;
  return (
    <EventCard title={e.name} href={one ? `/dashboard/bands/${bands[0].id}` : undefined} event={e}>
      <ul className={one ? "" : "divide-y divide-border rounded-md border border-border"}>
        {bands.map((b) => {
          const status = bandStatus(b);
          const now = live.get(b.id);
          const row = (
            <>
              <span className="block text-sm">
                <span className="font-medium">{b.band_name}</span> <span className="text-muted">· {b.school_name}</span>
              </span>
              <span className="mt-2 block">
                {now ? (
                  <DayStatusPill status={now} doneText={hasRooms(e.event_type) ? "Finished every room 🎉" : "Performed 🎉"} />
                ) : (
                  <Badge tone={status.tone}>{status.text}</Badge>
                )}
              </span>
            </>
          );
          return (
            <li key={b.id}>
              {one ? (
                row
              ) : (
                <Link href={`/dashboard/bands/${b.id}`} className="block px-3 py-2.5 hover:bg-background">
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </EventCard>
  );
}

const ROLE_LABEL = { volunteer_director: "Volunteer Lead", section_lead: "Coordinator" } as const;

function HelpingCard({ row: r, showType }: { row: StaffEvent & { events: EventSummary }; showType: boolean }) {
  return (
    <EventCard
      title={r.events.name}
      href={`/dashboard/events/${r.events.id}`}
      event={r.events}
      showType={showType}
      highlight={isToday(r.events)}
      badge={<Badge tone="info">{ROLE_LABEL[r.role]}</Badge>}
    >
      {isToday(r.events) && <p className="text-sm font-semibold text-brand">Happening today</p>}
    </EventCard>
  );
}

/** For directors and team members who don't host yet: a way to start (or ask to). */
function HostYourOwn({ invited }: { invited: boolean }) {
  const button = "inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover";
  return (
    <section aria-labelledby="host-your-own" className="rounded-lg border border-brand/25 bg-brand-soft p-5 sm:p-6">
      <h2 id="host-your-own" className="text-lg font-semibold">
        <span aria-hidden="true">🏟️</span> Host your own event
      </h2>
      <p className="mt-1 leading-7 text-muted">
        Set up and run your contest, festival, or school event in one place.
        {!invited && " Organizer accounts are by invitation while we're in the pilot."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        {invited ? (
          <Link href="/dashboard/setup" className={button}>
            Set up your account
          </Link>
        ) : (
          <Link href="/#join" className={button}>
            Join the pilot
          </Link>
        )}
      </div>
    </section>
  );
}

/** The Account Host: the person who can renew the plan (account_host, for the account's own hosts). */
type AccountHost = { isMe: boolean; name: string; email: string | null };

async function loadAccountHost(supabase: Awaited<ReturnType<typeof CreateClient>>, orgId: string, userId: string): Promise<AccountHost | null> {
  const { data, error } = await supabase.rpc("account_host", { p_org: orgId }).maybeSingle<{ user_id: string; name: string; email: string | null }>();
  // Unknown (an error, or before the database update): still point a Co-host to the Account Host, not to us.
  if (error || !data) return { isMe: false, name: "your Account Host", email: null };
  return { isMe: data.user_id === userId, name: data.name, email: data.email };
}

/** The Co-host's line: who can renew, with a way to reach them. */
function AskAccountHost({ host, orgName }: { host: AccountHost; orgName: string }) {
  const named = host.name !== "your Account Host";
  return (
    <>
      {host.email ? (
        <a href={`mailto:${host.email}?subject=${encodeURIComponent(`A plan for ${orgName}`)}`} className="font-medium text-brand underline underline-offset-4">
          Email {host.name}
        </a>
      ) : (
        <>Ask {host.name}</>
      )}
      {named && ", your Account Host,"} about a plan.
    </>
  );
}

/** Hosts: a free pilot or trial ending soon, or a free period or plan that has ended (and what that means). */
function PlanNotice({ org, ended, spot, accountHost }: { org: Organization; ended: string | null; spot: string | null; accountHost: AccountHost | null }) {
  if (org.suspended_at) {
    return (
      <p className="rounded-lg border border-danger/40 bg-warning-soft px-4 py-3 text-sm leading-6">
        <strong>This account is suspended.</strong> Its events are offline and can&apos;t be published. Email{" "}
        <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand underline">
          {brand.supportEmail}
        </a>{" "}
        if you think this is a mistake.
      </p>
    );
  }
  const askHost = accountHost && !accountHost.isMe ? accountHost : null;
  if (ended) {
    // An issue to act on, not just information: amber, with who can fix it.
    return (
      <div role="note" className="flex gap-3 rounded-lg border border-warning/50 bg-warning-soft px-4 py-3 text-sm leading-6">
        <LockIcon className="mt-0.5 size-5 text-warning" />
        <div className="space-y-2">
          <p>
            <strong>{ended}.</strong> Your published events stay up, and you can still set up any kind of event. Without a plan, you
            can publish one one-time parent-teacher conference at a time.{spot && ` ${spot}`}
          </p>
          {askHost ? (
            <p className="font-medium">
              <AskAccountHost host={askHost} orgName={org.name} />
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(`A plan for ${org.name}`)}`}
                className="inline-flex min-h-11 items-center rounded-md border border-field-border bg-surface px-4 font-semibold text-foreground hover:border-brand"
              >
                Email us about a plan
              </a>
              <span>
                <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand underline underline-offset-4">
                  {brand.supportEmail}
                </a>{" "}
                · we reply within a day
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }
  const free = freeStatus(org);
  if (!free || free.ended) return null;
  return (
    <p className={`rounded-lg px-4 py-3 text-sm leading-6 ${free.soon ? "border border-warning/40 bg-warning-soft" : "bg-brand-soft"}`}>
      {org.subscription_status === "trialing" ? "Free trial" : "Free pilot"} through <strong>{free.day}</strong>.
      {free.soon && (
        <>
          {" "}
          After that, you can publish one parent-teacher conference at a time.{" "}
          {askHost ? (
            <AskAccountHost host={askHost} orgName={org.name} />
          ) : (
            <>
              Email{" "}
              <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand underline">
                {brand.supportEmail}
              </a>{" "}
              to keep going.
            </>
          )}
        </>
      )}
    </p>
  );
}


