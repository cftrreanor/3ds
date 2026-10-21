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
  const teacherOnly = org.account_kind === "teacher";

  // Free teacher accounts host conferences only, so they skip the picker.
  if (teacherOnly && type !== "conference") redirect("/dashboard/events/new?type=conference");
  // No kind picked yet (e.g. a bookmarked link): ask first.
  if (!isEventType(type)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← All events
        </Link>
        <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">What kind of event is this?</h1>
        <p className="mt-2 leading-7 text-muted">You can change this later, until bands or groups register.</p>
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
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
        {type === "conference" ? "New parent-teacher conference" : `New ${eventTypeLabel(type).toLowerCase()}`}
      </h1>
      <p className="mt-2 leading-7 text-muted">
        {type === "conference"
          ? "Free during the pilot. Just the day and your hours for now. You'll set meeting times and where you'll meet next."
          : "Just the basics for now. You'll add stations and volunteer shifts next."}{" "}
        {!teacherOnly && (
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
      {teacherOnly && (
        <p className="mt-6 text-sm leading-6 text-muted">
          Planning a fair, band contest, or other school event?{" "}
          <Link href="/#join" className="font-medium text-brand underline-offset-4 hover:underline">
            Join the pilot
          </Link>{" "}
          and we&apos;ll set it up for your school.
        </p>
      )}
    </div>
  );
}
