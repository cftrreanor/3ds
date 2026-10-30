import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getMyOrganization } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { createEvent } from "../../actions";
import { EventForm } from "../_components/event-form";
import { SetupHeader } from "../_components/setup-steps";
import { SetupLogo } from "../_components/setup-logo";
import { loadBrand } from "@/lib/badges";
import { EventTypeChoices } from "@/components/event-type-picker";
import { eventTypeLabel, hasConferences, isEventType } from "@/lib/event-types";
import { loadAccountPlan, pickerSubtitle, startableTypes, typeNotes, typeWords } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ searchParams }: PageProps<"/dashboard/events/new">) {
  const org = await getMyOrganization();
  if (!org) redirect("/dashboard");
  const { type } = await searchParams;
  // The plan's own kinds come first in the picker; any other kind can be set up to try.
  // Before the packages update, teacher accounts host conferences only.
  const supabase = await createClient();
  const plan = await loadAccountPlan(supabase, org.id);
  const included = plan ? startableTypes(plan) : org.account_kind === "teacher" ? ["conference"] : undefined;
  const trial = isEventType(type) && included && !included.includes(type) ? type : null;
  // No kind picked yet (e.g. a bookmarked link): ask first.
  if (!isEventType(type)) {
    const { data: published } = plan
      ? await supabase.from("events").select("name, event_type, status, ends_on, timezone").eq("organization_id", org.id).eq("status", "published")
      : { data: null };
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← All events
        </Link>
        <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">What kind of event is this?</h1>
        {pickerSubtitle(plan, included) && <p className="mt-2 leading-7 text-muted">{pickerSubtitle(plan, included)}</p>}
        <div className="mt-8">
          <EventTypeChoices included={included} notes={plan ? typeNotes(plan, published ?? []) : undefined} />
        </div>
      </div>
    );
  }

  const changeKind = (
    <Link href="/dashboard/events/new" className="font-medium text-brand underline-offset-4 hover:underline">
      Change the kind of event
    </Link>
  );
  // A kind the plan doesn't include: say so up front, before any work goes in.
  const trialNote = trial && (
    <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-6">
      <strong>You&apos;re trying {typeWords(trial)}.</strong> Set it up and preview it as much as you like. Publishing needs a plan that
      includes {typeWords(trial)}, and until then it doesn&apos;t send invitations. See what&apos;s included on your{" "}
      <Link href="/dashboard/account" className="font-medium text-brand underline-offset-4 hover:underline">
        Account
      </Link>{" "}
      page.
    </p>
  );

  // Most events: the first of the guided setup's steps (the rest are in Event settings, ?setup=1).
  if (!hasConferences(type)) {
    // The account's logo and color, for an Account Host to set from the start.
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { org: org.id });
    const brand = isAdmin ? await loadBrand(org.id) : null;
    return (
      <div className="mx-auto max-w-5xl" data-required-marks>
        <SetupHeader current="details" back={{ href: "/dashboard", label: "All events" }}>
          {changeKind}
        </SetupHeader>
        {trialNote}
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Event details</h2>
          <p className="mt-1 text-sm text-muted">The name, dates, times, and venue everyone sees.</p>
          <div className="mt-4">
            <EventForm
              action={createEvent}
              organizationId={org.id}
              eventType={type}
              initial={{ timezone: org.default_timezone }}
              venueSearchEnabled={isPlacesConfigured}
              submitLabel="Save and continue"
              setup={{}}
              extra={brand && <SetupLogo eventId={null} logo={brand.logo} color={brand.color} />}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl" data-required-marks>
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← All events
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
        {type === "conference" ? "New parent-teacher conference" : type === "meeting" ? "New meetings" : `New ${eventTypeLabel(type).toLowerCase()}`}
      </h1>
      <p className="mt-2 leading-7 text-muted">
        {type === "conference"
          ? "Free during the pilot. Just a name for now. Next, you'll set your day or weekly hours and where you'll meet."
          : "Just a name for now. Next, you'll set your day or weekly hours and where you'll meet."}{" "}
        {changeKind}
      </p>
      {trialNote}
      <Card className="mt-8">
        <EventForm
          action={createEvent}
          organizationId={org.id}
          eventType={type}
          initial={{ timezone: org.default_timezone }}
          venueSearchEnabled={isPlacesConfigured}
          submitLabel="Create event"
        />
      </Card>
    </div>
  );
}
