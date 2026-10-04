import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { getMyOrganization } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/time";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const org = await getMyOrganization();

  if (!org) {
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

  const supabase = await createClient();
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
    </div>
  );
}
