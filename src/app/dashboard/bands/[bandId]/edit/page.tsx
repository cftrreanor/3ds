import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updateBand, withdrawBand } from "@/app/dashboard/band-actions";
import { BandForm } from "@/components/band-form";
import { hasRooms } from "@/lib/event-types";
import { BAND_COLUMNS, registrationIsOpen, type BandRow } from "@/lib/bands";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { WithdrawBandButton } from "../withdraw-band";

export const metadata: Metadata = { title: "Edit registration" };

export default async function EditBandPage({ params }: PageProps<"/dashboard/bands/[bandId]/edit">) {
  const { bandId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("bands").select(BAND_COLUMNS).eq("id", bandId).maybeSingle();
  const band = data as BandRow | null;
  if (!band) missing();
  const { data: event } = await supabase
    .from("events")
    .select("name, status, event_type, timezone, band_registration_open, band_registration_deadline, chaperone_limit, classifications, performance_order_published")
    .eq("id", band.event_id)
    .single();
  if (!event) missing();
  // Only while registration is open; after that, changes go through the organizer.
  if (!registrationIsOpen(event)) redirect(`/dashboard/bands/${bandId}`);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/dashboard/bands/${bandId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">Edit registration</h1>
      <p className="mt-1 text-muted">
        {band.band_name} · {band.school_name}
      </p>
      <div className="mt-6">
        <BandForm
          action={updateBand.bind(null, bandId)}
          classifications={event.classifications}
          chaperoneLimit={event.chaperone_limit}
          kind={hasRooms(event.event_type) ? "group" : "band"}
          submitLabel="Save changes"
          initial={{ ...band, head_director_phone: formatPhone(band.head_director_phone) }}
        />
      </div>
      <div className="mt-8 border-t border-border pt-4 text-sm">
        <WithdrawBandButton
          bandName={band.band_name}
          eventName={event.name}
          removes={!event.performance_order_published}
          one={hasRooms(event.event_type) ? "group" : "band"}
          action={withdrawBand.bind(null, bandId)}
        />
      </div>
    </div>
  );
}
