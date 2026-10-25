import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getMyOrganization } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { createEvent } from "../../actions";
import { EventForm } from "../_components/event-form";
import { EventTypeChoices } from "@/components/event-type-picker";
import { eventTypeLabel, isEventType } from "@/lib/event-types";
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

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← All events
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
        {type === "conference" ? "New parent-teacher conference" : type === "meeting" ? "New meetings" : `New ${eventTypeLabel(type).toLowerCase()}`}
      </h1>
      <p className="mt-2 leading-7 text-muted">
        {type === "conference"
          ? "Free during the pilot. Just a name for now. Next, you'll set your day or weekly hours and where you'll meet."
          : type === "meeting"
          ? "Just a name for now. Next, you'll set your day or weekly hours and where you'll meet."
          : "Just the basics for now. You'll add stations and volunteer shifts next."}{" "}
        {!onlyOne && (
          <Link href="/dashboard/events/new" className="font-medium text-brand underline-offset-4 hover:underline">
            Change the kind of event
          </Link>
        )}
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
