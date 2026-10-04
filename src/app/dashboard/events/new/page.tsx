import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getMyOrganization } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { createEvent } from "../../actions";
import { EventForm } from "../_components/event-form";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  const org = await getMyOrganization();
  if (!org) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← All events
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">New event</h1>
      <p className="mt-2 leading-7 text-muted">
        Just the basics for now. You&apos;ll add stations and volunteer shifts next.
      </p>
      <Card className="mt-8">
        <EventForm
          action={createEvent}
          organizationId={org.id}
          initial={{ timezone: org.default_timezone }}
          venueSearchEnabled={isPlacesConfigured}
          submitLabel="Create event"
        />
      </Card>
    </div>
  );
}
