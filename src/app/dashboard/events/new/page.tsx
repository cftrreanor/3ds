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

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ searchParams }: PageProps<"/dashboard/events/new">) {
  const org = await getMyOrganization();
  if (!org) redirect("/dashboard");
  const { type } = await searchParams;

  // No kind picked yet (e.g. a bookmarked link): ask first.
  if (!isEventType(type)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← All events
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">What kind of event is this?</h1>
        <p className="mt-2 leading-7 text-muted">You can change this later, as long as no bands have registered.</p>
        <div className="mt-8">
          <EventTypeChoices />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← All events
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">New {eventTypeLabel(type).toLowerCase()}</h1>
      <p className="mt-2 leading-7 text-muted">
        Just the basics for now. You&apos;ll add stations and volunteer shifts next.{" "}
        <Link href="/dashboard/events/new" className="font-medium text-brand underline-offset-4 hover:underline">
          Change the kind of event
        </Link>
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
    </div>
  );
}
