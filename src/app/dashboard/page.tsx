import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getMyOrganization } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/time";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Dashboard" };

type StaffEvent = {
  role: "volunteer_director" | "section_lead";
  events: { id: string; name: string; status: string; starts_on: string; ends_on: string; venue_name: string | null; venue_address: string } | null;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [org, { data: staffRows }] = await Promise.all([
    getMyOrganization(),
    supabase
      .from("event_staff")
      .select("role, events(id, name, status, starts_on, ends_on, venue_name, venue_address)")
      .eq("user_id", user.id),
  ]);
  const helping = ((staffRows ?? []) as unknown as StaffEvent[]).filter(
    (r): r is StaffEvent & { events: NonNullable<StaffEvent["events"]> } => r.events !== null,
  );

  if (!org && helping.length > 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Events you&apos;re helping run</h1>
        <HelpingList rows={helping} />
        <p className="mt-10 text-sm text-muted">
          Hosting your own contest?{" "}
          <Link href="/dashboard/setup" className="font-medium text-brand underline-offset-4 hover:underline">
            Set up your organization
          </Link>
        </p>
      </div>
    );
  }

  if (!org) {
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
      </div>
    );
  }

  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, starts_on, ends_on, venue_name, venue_address")
    .eq("organization_id", org.id)
    .order("starts_on", { ascending: true });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{org.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your events</h1>
        </div>
        <Link
          href="/dashboard/events/new"
          className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          New event
        </Link>
      </div>

      {events && events.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/dashboard/events/${e.id}`} className="block h-full">
                <Card className="h-full transition hover:border-brand">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold">{e.name}</h2>
                    <Badge tone={e.status === "published" ? "brand" : "neutral"}>
                      {e.status === "published" ? "Published" : e.status === "archived" ? "Archived" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{formatDateRange(e.starts_on, e.ends_on)}</p>
                  <p className="mt-1 text-sm text-muted">{e.venue_name ?? e.venue_address}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mt-8 text-center">
          <h2 className="font-semibold">No events yet</h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-muted">
            Create your first contest. It stays a private draft until you publish it, so you can set
            everything up at your own pace.
          </p>
          <Link
            href="/dashboard/events/new"
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            Create an event
          </Link>
        </Card>
      )}

      {helping.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Events you&apos;re helping run</h2>
          <HelpingList rows={helping} />
        </section>
      )}
    </div>
  );
}

const ROLE_LABEL = { volunteer_director: "Volunteer Director", section_lead: "Section Lead" } as const;

function HelpingList({ rows }: { rows: (StaffEvent & { events: NonNullable<StaffEvent["events"]> })[] }) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {rows.map((r) => (
        <li key={`${r.events.id}-${r.role}`}>
          <Link href={`/dashboard/events/${r.events.id}`} className="block h-full">
            <Card className="h-full transition hover:border-brand">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{r.events.name}</h3>
                <Badge tone="accent">{ROLE_LABEL[r.role]}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{formatDateRange(r.events.starts_on, r.events.ends_on)}</p>
              <p className="mt-1 text-sm text-muted">{r.events.venue_name ?? r.events.venue_address}</p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
