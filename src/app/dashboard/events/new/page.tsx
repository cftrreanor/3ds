import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getMyOrganization } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { createEvent } from "../../actions";
import { EventForm } from "../_components/event-form";
import { SetupHeader, VOLUNTEER_SETUP_STEPS } from "../_components/setup-steps";
import { SetupLogo } from "../_components/setup-logo";
import { loadBrand } from "@/lib/badges";
import { EventTypeChoices } from "@/components/event-type-picker";
import { eventTypeLabel, hasConferences, isEventType } from "@/lib/event-types";
import { endedSentence, loadAccountHost, loadAccountPlan, pickerGroups, planEnded, startableTypes, typeNotes, typeWords } from "@/lib/plan";
import { freeStatus } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { PlanAsk } from "@/components/plan-ask";
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
      ? await supabase.from("events").select("name, event_type, status, starts_on, ends_on, timezone").eq("organization_id", org.id).eq("status", "published")
      : { data: null };
    const ended = endedSentence(plan, freeStatus(org), org.subscription_status);
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← My events
        </Link>
        <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">What kind of event is this?</h1>
        <div className="mt-8">
          <EventTypeChoices
            included={included}
            notes={plan ? typeNotes(plan, published ?? []) : undefined}
            lead={plan && planEnded(plan) ? "conference" : undefined}
            groups={pickerGroups(plan, included, ended)}
          />
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
  // A kind the plan doesn't include: say so up front, before any work goes in, with who to ask for a plan.
  const user = trial ? await requireUser() : null;
  const host = user ? await loadAccountHost(supabase, org.id, user.id) : null;
  const trialNote = trial && (
    <div role="note" className="mt-4 flex gap-3 rounded-md border border-brand/25 bg-brand-soft px-4 py-3 text-sm leading-6">
      <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
      <div className="space-y-2">
        <p>
          <strong>You&apos;re trying {typeWords(trial)}.</strong> Set it up and preview it as much as you like. While you&apos;re trying it,
          emails go only to people on your {org.name} account. Publishing it, or inviting partners, volunteers, or families, needs a plan
          that includes {typeWords(trial)}.
        </p>
        {host && (
          <p>
            <PlanAsk host={host} orgName={org.name} kind={typeWords(trial)} />
          </p>
        )}
        <p>
          <Link href="/dashboard/account" className="font-medium text-brand underline underline-offset-4">
            See your plan
          </Link>
        </p>
      </div>
    </div>
  );

  // Most events: the first of the guided setup's steps (the rest are in Event settings, ?setup=1).
  if (!hasConferences(type)) {
    // The account's logo and color, for an Account Host to set from the start.
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { org: org.id });
    const brand = isAdmin ? await loadBrand(org.id) : null;
    return (
      <div className="mx-auto max-w-5xl" data-required-marks>
        <SetupHeader
          current="details"
          back={{ href: "/dashboard", label: "My events" }}
          steps={type === "volunteer" ? VOLUNTEER_SETUP_STEPS : undefined}
        >
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
        ← My events
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
