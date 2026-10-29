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
import { loadAccountPlan, startableTypes, typeWords } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ searchParams }: PageProps<"/dashboard/events/new">) {
  const org = await getMyOrganization();
  if (!org) redirect("/dashboard");
  const { type } = await searchParams;
  // What the package (and any unused passes) can start; before the packages update, teacher accounts host conferences only.
  const plan = await loadAccountPlan(await createClient(), org.id);
  const allowed = plan ? startableTypes(plan) : org.account_kind === "teacher" ? ["conference"] : undefined;
  const onlyOne = allowed?.length === 1 ? allowed[0] : null;

  // An account with one kind of event skips the picker.
  if (onlyOne && type !== onlyOne) redirect(`/dashboard/events/new?type=${onlyOne}`);
  const notIncluded = isEventType(type) && allowed && !allowed.includes(type) ? type : null;
  // No kind picked yet (e.g. a bookmarked link), or one the plan doesn't include: ask first.
  if (!isEventType(type) || notIncluded) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← All events
        </Link>
        <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">What kind of event is this?</h1>
        {notIncluded ? (
          <p className="mt-2 leading-7 text-danger">
            {`Your ${plan?.package_name ?? ""} plan doesn't include ${typeWords(notIncluded)}. Add a one-time event pass or upgrade. See what's included on your `}
            <Link href="/dashboard/account" className="font-medium text-brand underline-offset-4 hover:underline">
              Account
            </Link>{" "}
            page.
          </p>
        ) : (
          <p className="mt-2 leading-7 text-muted">You can change this later, until bands or groups register.</p>
        )}
        <div className="mt-8">
          <EventTypeChoices allowed={allowed} />
        </div>
      </div>
    );
  }

  const changeKind = !onlyOne && (
    <Link href="/dashboard/events/new" className="font-medium text-brand underline-offset-4 hover:underline">
      Change the kind of event
    </Link>
  );

  // Most events: the first of the guided setup's steps (the rest are in Event settings, ?setup=1).
  if (!hasConferences(type)) {
    // The account's logo and color, for an Account Host to set from the start.
    const supabase = await createClient();
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { org: org.id });
    const brand = isAdmin ? await loadBrand(org.id) : null;
    return (
      <div className="mx-auto max-w-5xl" data-required-marks>
        <SetupHeader current="details" back={{ href: "/dashboard", label: "All events" }}>
          {changeKind}
        </SetupHeader>
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
      {onlyOne && (
        <p className="mt-6 text-sm leading-6 text-muted">
          Planning a fair, band contest, or other school event? Add a one-time event pass or upgrade. See what&apos;s included on your{" "}
          <Link href="/dashboard/account" className="font-medium text-brand underline-offset-4 hover:underline">
            Account
          </Link>{" "}
          page.
        </p>
      )}
    </div>
  );
}
