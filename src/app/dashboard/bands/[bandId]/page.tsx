import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateBand, withdrawBand } from "@/app/dashboard/band-actions";
import { BandForm } from "@/components/band-form";
import { Badge, Card } from "@/components/ui";
import { BAND_COLUMNS, readyAt, warmUpEndAt, type BandRow } from "@/lib/bands";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatTime, utcToZonedDate, zoneAbbreviation } from "@/lib/time";
import { DeleteButton } from "../../events/[eventId]/forms";

export const metadata: Metadata = { title: "Band registration" };

export default async function BandPage({ params, searchParams }: PageProps<"/dashboard/bands/[bandId]">) {
  const { bandId } = await params;
  const { registered } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("bands").select(BAND_COLUMNS).eq("id", bandId).maybeSingle();
  const band = data as BandRow | null;
  if (!band) notFound();

  const [{ data: event }, { data: slot }] = await Promise.all([
    supabase
      .from("events")
      .select("name, slug, timezone, starts_on, ends_on, venue_name, venue_address, band_registration_open, performance_order_published, chaperone_limit, classifications, ready_minutes_before")
      .eq("id", band.event_id)
      .single(),
    supabase.from("performance_slots").select("performance_order, warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("band_id", bandId).maybeSingle(),
  ]);
  if (!event) notFound();
  const tz = event.timezone;
  const warmEnd = slot ? warmUpEndAt(slot.warm_up_at, slot.warm_up_minutes) : null;
  const ready = slot ? readyAt(slot.perform_at, event.ready_minutes_before) : null;
  const at = (iso: string | null) =>
    iso ? `${formatDate(utcToZonedDate(iso, tz), { year: undefined })} · ${formatTime(iso, tz)} ${zoneAbbreviation(iso, tz)}` : "To be announced";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      {registered && (
        <Card className="mt-4 bg-accent-soft" role="status">
          <p className="font-medium">You&apos;re registered! 🎺</p>
          <p className="mt-1 text-sm text-muted">We emailed you a copy. We&apos;ll email again when performance times are posted.</p>
        </Card>
      )}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{band.band_name}</h1>
      <p className="mt-1 text-muted">
        {band.school_name} · {event.name} · {formatDateRange(event.starts_on, event.ends_on)}
      </p>

      <Card className="mt-6">
        <h2 className="font-semibold">Your times</h2>
        {event.performance_order_published && slot ? (
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Order</dt>
              <dd className="text-2xl font-semibold">#{slot.performance_order}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Warm-up</dt>
              <dd className="font-medium">{at(slot.warm_up_at)}</dd>
              {warmEnd && (
                <dd className="text-sm text-muted">
                  Until {formatTime(warmEnd, tz)} ({slot.warm_up_minutes} min)
                </dd>
              )}
              {slot.warm_up_location && <dd className="text-sm text-muted">{slot.warm_up_location}</dd>}
            </div>
            <div>
              <dt className="text-sm text-muted">Ready position</dt>
              <dd className="font-medium">{at(ready)}</dd>
              <dd className="text-sm text-muted">{event.ready_minutes_before} minutes before your performance</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Performance</dt>
              <dd className="font-medium">{at(slot.perform_at)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">
            The host hasn&apos;t posted the performance order yet. We&apos;ll email you when it&apos;s ready.
          </p>
        )}
        <Link href={`/e/${event.slug}`} className="mt-4 inline-block text-sm font-medium text-brand underline-offset-4 hover:underline">
          Event page &amp; full schedule
        </Link>
      </Card>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Registration details</h2>
        <Badge tone={event.band_registration_open ? "accent" : "neutral"}>
          {event.band_registration_open ? "Editable until registration closes" : "Registration closed"}
        </Badge>
      </div>
      <div className="mt-4">
        <BandForm
          action={updateBand.bind(null, bandId)}
          classifications={event.classifications}
          chaperoneLimit={event.chaperone_limit}
          submitLabel="Save changes"
          disabled={!event.band_registration_open}
          initial={{ ...band, head_director_phone: formatPhone(band.head_director_phone) }}
        />
      </div>
      {event.band_registration_open && (
        <div className="mt-8 border-t border-border pt-4 text-sm">
          <DeleteButton
            action={withdrawBand.bind(null, bandId)}
            label="Withdraw this band"
            text="Withdraw this band"
            confirmMessage={`Withdraw ${band.band_name} from ${event.name}? This can't be undone.`}
          />
        </div>
      )}
    </div>
  );
}
