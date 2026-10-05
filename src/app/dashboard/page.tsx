import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { registrationIsOpen } from "@/lib/bands";
import { getMyOrganization } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatTime, utcToZonedDate, zoneAbbreviation } from "@/lib/time";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Dashboard" };

type EventSummary = {
  id: string;
  name: string;
  status: string;
  timezone: string;
  starts_on: string;
  ends_on: string;
  venue_name: string | null;
  venue_address: string;
};

type MyBand = {
  id: string;
  band_name: string;
  school_name: string;
  events:
    | (EventSummary & { band_registration_open: boolean; band_registration_deadline: string | null; performance_order_published: boolean; finalists_revealed: boolean })
    | null;
  // Only readable once the host publishes, so these double as "times are posted".
  performance_slots: { perform_at: string | null } | { perform_at: string | null }[] | null;
  finals_slots: { perform_at: string | null }[];
};

type StaffEvent = { role: "volunteer_director" | "section_lead"; events: EventSummary | null };

const EVENT_COLUMNS = "id, name, status, timezone, starts_on, ends_on, venue_name, venue_address";

/** Has the event ended, in its own time zone? */
function isPast(e: { ends_on: string; timezone: string }) {
  return e.ends_on < utcToZonedDate(new Date().toISOString(), e.timezone);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [org, { data: staffRows }, { data: bandRows }] = await Promise.all([
    getMyOrganization(),
    supabase.from("event_staff").select(`role, events(${EVENT_COLUMNS})`).eq("user_id", user.id),
    supabase
      .from("bands")
      .select(
        `id, band_name, school_name,
         events(${EVENT_COLUMNS}, band_registration_open, band_registration_deadline, performance_order_published, finalists_revealed),
         performance_slots(perform_at), finals_slots(perform_at)`,
      )
      .eq("director_user_id", user.id),
  ]);
  const myBands = ((bandRows ?? []) as unknown as MyBand[])
    .filter((b): b is MyBand & { events: NonNullable<MyBand["events"]> } => b.events != null)
    .sort((a, b) => a.events.starts_on.localeCompare(b.events.starts_on) || a.band_name.localeCompare(b.band_name));
  const helping = ((staffRows ?? []) as unknown as StaffEvent[])
    .filter((r): r is StaffEvent & { events: EventSummary } => r.events != null)
    .sort((a, b) => a.events.starts_on.localeCompare(b.events.starts_on));

  const hosted = org
    ? ((
        await supabase.from("events").select(EVENT_COLUMNS).eq("organization_id", org.id).order("starts_on", { ascending: true })
      ).data ?? []) as EventSummary[]
    : [];

  if (!org && helping.length === 0 && myBands.length === 0) {
    // People who only volunteer belong on their shifts page, not host setup.
    const { count } = await supabase.from("volunteers").select("id", { count: "exact", head: true });
    if (count) redirect("/my");
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome! Let&apos;s set up your organization</h1>
        <p className="mt-2 leading-7 text-muted">
          This is the group that hosts your contest. You can invite other organizers later.
        </p>
        <Card className="mt-8">
          <OnboardingForm />
        </Card>
        <p className="mt-6 text-sm text-muted">
          Registering a band for someone else&apos;s contest? Use the registration link the host sent you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {org && (
        <Section
          icon="🏟️"
          title="Hosting"
          description={`Contests ${org.name} is putting on.`}
          action={
            <Link
              href="/dashboard/events/new"
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
            >
              New event
            </Link>
          }
          items={hosted.map((e) => ({ key: e.id, past: isPast(e), node: <HostedCard event={e} /> }))}
          empty={
            <Card className="text-center">
              <h3 className="font-semibold">No events yet</h3>
              <p className="mx-auto mt-2 max-w-md leading-7 text-muted">
                Create your first contest. It stays a private draft until you publish it, so you can set everything
                up at your own pace.
              </p>
            </Card>
          }
        />
      )}

      {myBands.length > 0 && (
        <Section
          icon="🎺"
          title="Competing"
          description="Your bands' registrations at contests."
          items={myBands.map((b) => ({ key: b.id, past: isPast(b.events), node: <BandCard band={b} /> }))}
        />
      )}

      {helping.length > 0 && (
        <Section
          icon="🙋"
          title="Helping run"
          description="Contests where you're on the host's team."
          items={helping.map((r) => ({ key: `${r.events.id}-${r.role}`, past: isPast(r.events), node: <HelpingCard row={r} /> }))}
        />
      )}

      {!org && (
        <p className="text-sm text-muted">
          Hosting your own contest?{" "}
          <Link href="/dashboard/setup" className="font-medium text-brand underline-offset-4 hover:underline">
            Set up your organization
          </Link>
        </p>
      )}
    </div>
  );
}

/** A role's section: upcoming cards up top, past ones folded away underneath. */
function Section({
  icon,
  title,
  description,
  action,
  items,
  empty,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
  items: { key: string; past: boolean; node: ReactNode }[];
  empty?: ReactNode;
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
      <div className="mt-6">
        {upcoming.length > 0 ? grid(upcoming) : items.length === 0 && empty ? empty : (
          <p className="text-sm text-muted">Nothing coming up.</p>
        )}
      </div>
      {past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
            Past ({past.length})
          </summary>
          <div className="mt-4 opacity-80">{grid(past)}</div>
        </details>
      )}
    </section>
  );
}

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block h-full">
      <Card className="h-full transition hover:border-brand">{children}</Card>
    </Link>
  );
}

const where = (e: EventSummary) => e.venue_name ?? e.venue_address;

function HostedCard({ event: e }: { event: EventSummary }) {
  return (
    <CardLink href={`/dashboard/events/${e.id}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{e.name}</h3>
        <Badge tone={e.status === "published" ? "brand" : "neutral"}>
          {e.status === "published" ? "Published" : e.status === "archived" ? "Archived" : "Draft"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted">{formatDateRange(e.starts_on, e.ends_on)}</p>
      <p className="mt-1 text-sm text-muted">{where(e)}</p>
    </CardLink>
  );
}

/** Where a band stands at a contest, in one line. */
function bandStatus(b: MyBand & { events: NonNullable<MyBand["events"]> }): { text: string; tone: "brand" | "accent" | "neutral" } {
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

function BandCard({ band: b }: { band: MyBand & { events: NonNullable<MyBand["events"]> } }) {
  const status = bandStatus(b);
  return (
    <CardLink href={`/dashboard/bands/${b.id}`}>
      <p className="text-sm font-medium text-muted">{formatDateRange(b.events.starts_on, b.events.ends_on)}</p>
      <h3 className="mt-1 font-semibold">{b.events.name}</h3>
      <p className="mt-1 text-sm text-muted">{where(b.events)}</p>
      <p className="mt-3 text-sm">
        <span className="font-medium">{b.band_name}</span> <span className="text-muted">· {b.school_name}</span>
      </p>
      <div className="mt-3">
        <Badge tone={status.tone}>{status.text}</Badge>
      </div>
    </CardLink>
  );
}

const ROLE_LABEL = { volunteer_director: "Volunteer Lead", section_lead: "Section Lead" } as const;

function HelpingCard({ row: r }: { row: StaffEvent & { events: EventSummary } }) {
  return (
    <CardLink href={`/dashboard/events/${r.events.id}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{r.events.name}</h3>
        <Badge tone="accent">{ROLE_LABEL[r.role]}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted">{formatDateRange(r.events.starts_on, r.events.ends_on)}</p>
      <p className="mt-1 text-sm text-muted">{where(r.events)}</p>
    </CardLink>
  );
}
