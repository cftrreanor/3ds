import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeaderBar } from "@/components/logo";
import { Card } from "@/components/ui";
import { hasParents } from "@/lib/event-types";
import { GRADES } from "@/lib/grades";
import { closesAtLabel, ID_REMINDER, parentRegistrationClosed } from "@/lib/parents";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange, formatTimeRange } from "@/lib/time";
import { registerParents } from "./actions";
import { ParentsForm } from "./parents-form";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function loadEvent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, status, event_type, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, public_notes, parent_registration_open, parent_registration_closes_at, parent_walk_ins_allowed")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  return { title: event ? `Register: ${event.name}` : "Parent registration" };
}

/** Parents register before a school visitor event. */
export default async function ParentRegistrationPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { canceled } = await searchParams;
  const event = await loadEvent(slug);
  if (!event) missing();
  if (!hasParents(event.event_type)) redirect(`/e/${slug}`);

  const closed = parentRegistrationClosed(event);

  return (
    <>
      <HeaderBar maxWidth="max-w-2xl" href={`/e/${slug}`} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        <header>
          <p className="text-sm font-medium text-muted">Parent registration</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{event.name}</h1>
          <p className="mt-2 text-muted">
            {formatDateRange(event.starts_on, event.ends_on)} · {formatTimeRange(event.window_start, event.window_end, event.timezone)}
          </p>
          <p className="mt-1 text-muted">{[event.venue_name, event.venue_address].filter(Boolean).join(" · ")}</p>
          {event.public_notes && <p className="mt-4 leading-7">{event.public_notes}</p>}
        </header>

        {canceled === "1" && (
          <Card className="mt-6 bg-brand-soft" role="status">
            <p className="font-medium">Your registration was canceled.</p>
          </Card>
        )}

        <div className="mt-8">
          {!closed ? (
            <>
              <p className="mb-6 leading-7 text-muted">
                Please register everyone you&apos;re coming for before the event. At the door, a staff member checks your
                name and your photo ID.
              </p>
              {event.parent_registration_closes_at && (
                <p className="mb-6 font-medium">
                  Registration closes {closesAtLabel(event.parent_registration_closes_at, event.timezone)}.
                </p>
              )}
              <ParentsForm action={registerParents.bind(null, event.id, slug)} grades={GRADES} idReminder={ID_REMINDER} />
            </>
          ) : (closed === "closed" || closed === "deadline") && event.parent_walk_ins_allowed ? (
            <Card className="space-y-3">
              <p className="text-lg font-semibold">Registration is closed, but you can still attend.</p>
              <p className="leading-7">
                Come during the event, {formatDateRange(event.starts_on, event.ends_on)},{" "}
                {formatTimeRange(event.window_start, event.window_end, event.timezone)}
                {event.venue_name ? ` at ${event.venue_name}` : ""}, and check in at the door.
              </p>
              <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 font-medium">
                🪪 Every adult must bring a valid government-issued photo ID (driver&apos;s license, state ID or passport).
                You won&apos;t be let in without it.
              </p>
            </Card>
          ) : (
            <Card>
              <p className="font-medium">
                {closed === "draft" ? "Preview: this page isn't public yet." : closed === "over" ? "This event is over." : "Registration is closed."}
              </p>
              {(closed === "closed" || closed === "deadline") && (
                <p className="mt-1 text-sm text-muted">Please contact the school if you still need to attend.</p>
              )}
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
