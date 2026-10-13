import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { setBandRegistrationOpen, updateBandSettings } from "@/app/dashboard/band-actions";
import { Card } from "@/components/ui";
import { SetupStep, StepStatus } from "@/components/setup-step";
import { requireUser } from "@/lib/auth";
import { sendBandInvites } from "@/app/dashboard/band-invite-actions";
import { importBandPrefills } from "@/app/dashboard/import-actions";
import { SpreadsheetImport } from "@/components/spreadsheet-import";
import { importFields } from "@/lib/imports";
import { InvitePastBands, type PastDirector } from "./invite-past-bands";
import { groupWords, hasEnsembles, hasRooms } from "@/lib/event-types";
import { BAND_COLUMNS, deadlinePassed, registrationIsOpen, type BandRow } from "@/lib/bands";
import { getEventAccess, getOrigin } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { ActionButton, CopyLinkButton } from "../forms";
import { BandSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Registration" };

export default async function BandsPage({ params }: PageProps<"/dashboard/events/[eventId]/bands">) {
  const { eventId } = await params;
  const access = await getEventAccess(eventId);
  // Volunteer and Section Leads get the read-only schedule instead.
  if (!access.isHost) redirect(`/dashboard/events/${eventId}/schedule`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, slug, name, status, event_type, timezone, starts_on, ends_on, band_registration_open, band_registration_deadline, director_info, chaperone_limit, classifications")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  if (!hasEnsembles(event.event_type)) redirect(`/dashboard/events/${eventId}`);
  const roomsHere = hasRooms(event.event_type);
  const w = groupWords(event.event_type);

  const user = await requireUser();
  const [{ data: bandData }, { data: contact }, { data: contactPhone }, { data: profile }] = await Promise.all([
    supabase.from("bands").select(BAND_COLUMNS).eq("event_id", eventId).order("created_at"),
    supabase.from("event_director_contacts").select("name, email").eq("event_id", eventId).maybeSingle(),
    supabase.rpc("director_contact_phone", { ev: eventId }),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
  ]);
  const [{ data: pastData }, { data: prefillData }, { data: inviteData }] = await Promise.all([
    supabase.rpc("past_band_directors", { p_event: eventId }),
    supabase.from("band_prefills").select("email, band_name, school_name, head_director_name").eq("event_id", eventId).order("created_at"),
    supabase.from("band_invitations").select("email, sent_at").eq("event_id", eventId),
  ]);
  const invitedLabel = (iso: string) => `Invited ${formatDate(utcToZonedDate(iso, event.timezone), { year: undefined })}`;
  const invitedAt = new Map((inviteData ?? []).map((i) => [i.email.toLowerCase(), i.sent_at as string]));
  const registeredEmails = new Set(((bandData ?? []) as BandRow[]).map((b) => b.head_director_email.toLowerCase()));
  // Directors whose details the host imported, one line per director.
  const imported = new Map<string, PastDirector>();
  for (const p of (prefillData ?? []) as { email: string; band_name: string; school_name: string | null; head_director_name: string | null }[]) {
    const email = p.email.toLowerCase();
    const band = p.school_name ? `${p.band_name} (${p.school_name})` : p.band_name;
    const d = imported.get(email);
    if (d) d.bands.push(band);
    else
      imported.set(email, {
        email,
        name: p.head_director_name ?? "",
        bands: [band],
        note: "From your spreadsheet",
        registered: registeredEmails.has(email),
        invited: invitedAt.has(email) ? invitedLabel(invitedAt.get(email)!) : null,
      });
  }
  const pastDirectors: PastDirector[] = ((pastData ?? []) as {
    email: string;
    full_name: string;
    bands: string[];
    last_event: string;
    registered: boolean;
    invited_at: string | null;
  }[]).map((d) => ({
    email: d.email,
    name: d.full_name,
    bands: d.bands,
    note: `Last registered for ${d.last_event}`,
    registered: d.registered,
    invited: d.invited_at ? invitedLabel(d.invited_at) : null,
  }));
  // Past directors are band directors so far; group events start fresh.
  const directors = [...imported.values(), ...(roomsHere ? [] : pastDirectors.filter((d) => !imported.has(d.email.toLowerCase())))];
  const regOpen = registrationIsOpen(event);
  const pastDeadline = event.band_registration_open && deadlinePassed(event);
  const bands = (bandData ?? []) as BandRow[];
  const origin = await getOrigin();
  const registrationUrl = `${origin}/e/${event.slug}/bands`;



  // The steps, in order. Inviting directors is optional, so it never holds the others back.
  // (The performance schedule has its own page: Performance Schedule Setup.)
  const settingsDone = Boolean(contact);
  const published = event.status === "published";
  const invitesSent = (inviteData ?? []).length > 0;
  const toInvite = directors.some((d) => !d.registered && !d.invited);
  // Registration counts as dealt with once it's open, or it closed after directors registered.
  const registrationDone = regOpen || pastDeadline || bands.length > 0;
  // Open the first step that still needs doing; the rest stay folded.
  const openStep = !settingsDone ? 1 : !registrationDone ? 2 : regOpen && toInvite ? 3 : 0;
  const registrationStatus = regOpen ? (
    <StepStatus done doneLabel="Open" />
  ) : (
    <StepStatus
      done={false}
      todoLabel={pastDeadline ? "Closed: deadline passed" : bands.length > 0 ? "Closed" : !published ? "Publish the event first" : "Needs to be done"}
    />
  );

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">{w.One} Registration</h1>
      <p className="mt-2 text-sm text-muted">
        {bands.length} {bands.length === 1 ? w.one : w.many} registered · Registration {regOpen ? "open" : "closed"}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <SetupStep
          id="registration-settings"
          title="1. Registration settings"
          status={<StepStatus done={settingsDone} />}
          open={openStep === 1}
          intro={`What directors see and agree to when they register. Save to finish this step.`}
        >
          <BandSettingsForm
            action={updateBandSettings.bind(null, eventId)}
            chaperoneLimit={event.chaperone_limit}
            classifications={event.classifications}
            deadline={event.band_registration_deadline ?? ""}
            directorInfo={event.director_info ?? ""}
            contact={{
              name: contact?.name || profile?.full_name || "",
              phone: formatPhone(contact ? contactPhone : profile?.phone),
              email: contact?.email || user.email || "",
            }}
            contactSaved={Boolean(contact)}
          />
        </SetupStep>

        <SetupStep
          id="open-registration"
          title="2. Open registration"
          status={registrationStatus}
          open={openStep === 2}
          intro={`Share the link with ${w.one} directors, then open registration so they can sign up.`}
        >
          <div className="space-y-4">
            {!published && (
              <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
                Publish the event from its main page first, then open registration here.
              </p>
            )}
            {published && !settingsDone && !regOpen && (
              <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm">
                Save your registration settings (step 1) first, so directors see the right classifications and information.
              </p>
            )}
            {event.band_registration_deadline && (
              <p className="text-sm text-muted">
                {pastDeadline
                  ? `The deadline (${formatDate(event.band_registration_deadline)}) has passed. Change it in step 1 to reopen.`
                  : `Closes automatically at the end of ${formatDate(event.band_registration_deadline)}.`}
              </p>
            )}
            <div>
              <p className="text-sm font-medium">Link for {w.one} directors</p>
              <p className="mt-1 break-all text-sm text-muted">{registrationUrl}</p>
              <div className="mt-2">
                <CopyLinkButton url={registrationUrl} label="Copy link" />
              </div>
            </div>
            {published && (
              <ActionButton
                action={setBandRegistrationOpen.bind(null, eventId, !event.band_registration_open)}
                variant={event.band_registration_open ? "stop" : "go"}
                confirmMessage={event.band_registration_open ? `Close ${w.one} registration? Directors won't be able to register or make changes.` : undefined}
              >
                {event.band_registration_open ? `Close ${w.one} registration` : `Open ${w.one} registration`}
              </ActionButton>
            )}
          </div>
        </SetupStep>

        <SetupStep
          id="invite-directors"
          title="3. Invite directors"
          status={<StepStatus done={invitesSent} doneLabel="Invitations sent" todoLabel="Optional" />}
          open={openStep === 3}
          intro={`Bring in ${w.many} you already work with, and email their directors an invitation to register.`}
        >
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold">Import from a spreadsheet</h3>
              <p className="mt-1 mb-3 text-sm text-muted">
                Each director&apos;s details are saved for them. Nobody is registered yet: invite the directors below, and
                each one checks their details and registers.
              </p>
              <SpreadsheetImport
                kind="bands"
                fields={importFields("bands", { words: w, trucks: !roomsHere })}
                choices={{ classification: event.classifications.map((c: string) => ({ value: c, label: c })) }}
                chaperoneLimit={event.chaperone_limit}
                noun={{ one: w.one, many: w.many }}
                templateName={`${w.one}-registrations.csv`}
                action={importBandPrefills.bind(null, eventId)}
              />
            </div>
            <div>
              <h3 className="font-semibold">Send invitations</h3>
              {directors.length > 0 ? (
                <>
                  <p className="mt-1 mb-3 text-sm text-muted">
                    {imported.size > 0 ? "Directors from your spreadsheet" : "Directors who registered at your earlier events"}
                    {imported.size > 0 && !roomsHere && pastDirectors.length > 0 ? " and your earlier events" : ""}. Their
                    {` ${w.one}`}&apos;s details are saved, so registering only takes a moment.
                  </p>
                  <InvitePastBands directors={directors} canSend={regOpen} send={sendBandInvites.bind(null, eventId)} one={w.one} />
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  Directors from your spreadsheet{roomsHere ? "" : " and your earlier events"} show up here to invite.
                </p>
              )}
            </div>
          </div>
        </SetupStep>
      </div>

      <section className="mt-10" aria-labelledby="registered-heading">
        <h2 id="registered-heading" className="text-xl font-semibold">
          Registered {w.many} ({bands.length})
        </h2>
        {bands.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-muted">No {w.many} have registered yet. They show up here as directors sign up.</p>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {bands.map((b) => (
              <li key={b.id}>
                <details className="rounded-xl border border-border bg-surface px-4 py-3">
                  <summary className="cursor-pointer">
                    <span className="font-semibold">{b.band_name}</span>
                    <span className="text-muted">
                      {" "}
                      · {b.school_name} · {b.classification} · {b.student_count} {roomsHere ? "participants" : "students"}
                    </span>
                  </summary>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <Detail label="Head director">
                      {b.head_director_name} ·{" "}
                      <a className="text-brand hover:underline" href={`tel:${b.head_director_phone}`}>
                        {formatPhone(b.head_director_phone)}
                      </a>{" "}
                      ·{" "}
                      <a className="text-brand hover:underline" href={`mailto:${b.head_director_email}`}>
                        {b.head_director_email}
                      </a>
                    </Detail>
                    <Detail label="Assistant directors">{b.assistant_directors.join(", ") || "None listed"}</Detail>
                    <Detail label={`${w.One} contact`}>{b.contact_email}</Detail>
                    <Detail label="School address">{b.school_address || "Not given"}</Detail>
                    <Detail label="People">
                      {b.student_count} {roomsHere ? "participants" : "students"} · {b.chaperone_count} chaperones
                    </Detail>
                    <Detail label="Vehicles">
                      {roomsHere
                        ? `${b.bus_count} ${b.bus_count === 1 ? "bus" : "buses"}`
                        : `${b.bus_count} buses · ${b.box_truck_count} box trucks · ${b.truck_trailer_count} truck/trailers · ${b.semi_truck_count} semis`}
                    </Detail>
                    <Detail label="Conflicts">{b.contest_day_conflicts ?? "None"}</Detail>
                    <Detail label="Accessibility / staging">{b.special_needs ?? "None"}</Detail>
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
