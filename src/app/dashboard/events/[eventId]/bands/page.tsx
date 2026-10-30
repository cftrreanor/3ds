import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { publishAndOpenBandRegistration, reopenBandRegistration, setBandRegistrationOpen, updateBandSettings } from "@/app/dashboard/band-actions";
import { Badge, Card } from "@/components/ui";
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
import { SavedBy } from "@/components/saved-by";
import { RegisteredBands } from "./registered-bands";
import { SetupTabs } from "../../_components/setup-tabs";
import { ReopenRegistration } from "./reopen-registration";

export const metadata: Metadata = { title: "Registration" };

/**
 * Band (or group) Registration, like Volunteer Setup: a card with where
 * registration stands, its link, and the one button for what's next; then
 * tabs: Registered bands (once registration has opened), Registration
 * settings, and Invite directors.
 */
export default async function BandsPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/bands">) {
  const { eventId } = await params;
  const { tab } = await searchParams;
  const access = await getEventAccess(eventId);
  // Volunteer and Coordinators get the read-only schedule instead.
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
  const today = utcToZonedDate(new Date().toISOString(), event.timezone);
  const pastDeadline = event.band_registration_open && deadlinePassed(event);
  const bands = (bandData ?? []) as BandRow[];
  const origin = await getOrigin();
  const registrationUrl = `${origin}/e/${event.slug}/bands`;



  const settingsDone = Boolean(contact);
  const published = event.status === "published";
  const invitesSent = (inviteData ?? []).length > 0;
  // Registered bands shows once registration has opened (or closed after it did): before that there's nothing to see.
  const showBands = regOpen || pastDeadline || bands.length > 0;
  // Directors who were emailed an invitation and haven't registered yet.
  const invitedWaiting = directors.filter((d) => d.invited && !d.registered).length;

  // The open tab: ?tab=, else the bands once there are any to show, else the settings.
  const tabs = [...(showBands ? ["bands"] : []), "settings", "invite"] as const;
  const current = tabs.find((t) => t === tab) ?? (showBands ? "bands" : "settings");
  const base = `/dashboard/events/${eventId}/bands`;
  const [qrSvg, qrPng] = await Promise.all([
    QRCode.toString(registrationUrl, { type: "svg", margin: 1, width: 160 }),
    QRCode.toDataURL(registrationUrl, { margin: 2, width: 1024 }),
  ]);
  const smallButton = "inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-background";

  return (
    // data-required-marks: a small asterisk on each box that has to be filled in (globals.css).
    <div data-required-marks>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">{w.One} Registration</h1>
      <SavedBy eventId={eventId} area="bands" className="mt-2" />

      {/* Where registration stands, its link, and the one button for what's next. */}
      <Card className="mt-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={!published ? "neutral" : regOpen ? "live" : "neutral"}>
                {!published ? "Event not published" : regOpen ? "Registration open" : "Registration closed"}
              </Badge>
              <span className="text-muted">
                {[
                  showBands ? `${bands.length} ${bands.length === 1 ? w.one : w.many} registered` : null,
                  regOpen && event.band_registration_deadline
                    ? `Closes at the end of ${formatDate(event.band_registration_deadline)}`
                    : pastDeadline
                      ? `The deadline (${formatDate(event.band_registration_deadline!)}) has passed`
                      : regOpen
                        ? "No deadline set"
                        : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </p>
            {invitedWaiting > 0 && (
              <p className="text-sm">
                <Link href={`${base}?tab=invite`} scroll={false} className="font-medium text-brand underline-offset-4 hover:underline">
                  {invitedWaiting} invited {invitedWaiting === 1 ? "director hasn't" : "directors haven't"} registered yet
                </Link>
              </p>
            )}
          </div>
          {!settingsDone && !regOpen && (
            <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
              Save your{" "}
              <Link href={`${base}?tab=settings`} scroll={false} className="font-medium underline">
                registration settings
              </Link>{" "}
              first, so directors see the right classifications and information.
            </p>
          )}
          <div>
            <p className="text-sm font-medium">Registration link</p>
            <p className="mt-1 break-all text-sm text-muted">{registrationUrl}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyLinkButton url={registrationUrl} label="Copy link" />
              <a href={`/e/${event.slug}/bands`} target="_blank" className={smallButton}>
                Preview page
              </a>
              {!published && (
                <ActionButton
                  action={publishAndOpenBandRegistration.bind(null, eventId)}
                  variant="go"
                  className="px-3! text-xs!"
                  pendingText="Publishing…"
                  confirmMessage={`Publish the event and open ${w.one} registration? Your event page goes live and directors can start registering.`}
                >
                  Publish and open registration
                </ActionButton>
              )}
              {published && !pastDeadline && (
                <ActionButton
                  action={setBandRegistrationOpen.bind(null, eventId, !event.band_registration_open)}
                  variant={event.band_registration_open ? "stop" : "go"}
                  className="px-3! text-xs!"
                  confirmMessage={event.band_registration_open ? `Close ${w.one} registration? Directors won't be able to register or make changes.` : undefined}
                >
                  {event.band_registration_open ? "Close registration" : "Open registration"}
                </ActionButton>
              )}
              {/* Opens a new-deadline box, which takes its own line. */}
              {published && pastDeadline && <ReopenRegistration action={reopenBandRegistration.bind(null, eventId)} today={today} />}
            </div>
            <p className="mt-2 text-sm text-muted">
              Directors who use this link confirm their email with a code after they fill in the form. Directors you{" "}
              <Link href={`${base}?tab=invite`} scroll={false} className="font-medium text-brand underline-offset-4 hover:underline">
                invite by email
              </Link>{" "}
              register with one tap, with no code.
            </p>
            {/* Tucked away to keep the top of the page short; open it to show or download the code. */}
            <details className="group mt-1">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
                <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
                  ›
                </span>
                QR code
              </summary>
              <div className="mt-2 flex flex-col items-start gap-2">
                <div
                  className="rounded-lg border border-border bg-white p-2"
                  aria-label="QR code for the registration link"
                  role="img"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <a href={qrPng} download={`${event.slug}-${w.one}-registration-qr.png`} className="inline-flex min-h-11 items-center text-xs font-medium text-brand underline-offset-4 hover:underline">
                  Download QR code
                </a>
              </div>
            </details>
          </div>
        </div>
      </Card>

      <div className="mt-10">
        <SetupTabs
          label={`${w.One} registration`}
          tabs={[
            ...(showBands
              ? [{ key: "bands", label: `Registered ${w.many}`, status: `${bands.length} ${bands.length === 1 ? w.one : w.many}`, href: `${base}?tab=bands`, active: current === "bands" }]
              : []),
            {
              key: "settings",
              label: "Registration settings",
              status: settingsDone ? "Saved" : "Needs to be done",
              mark: settingsDone ? ("done" as const) : ("todo" as const),
              href: `${base}?tab=settings`,
              active: current === "settings",
            },
            { key: "invite", label: "Invite directors", status: invitesSent ? "Invitations sent" : "Optional", href: `${base}?tab=invite`, active: current === "invite" },
          ]}
        />
        <div className="mt-6">
          {current === "bands" && (
            <RegisteredBands
              bands={bands}
              classifications={event.classifications}
              words={w}
              groups={roomsHere}
              fileName={`${event.name.replace(/[^\w -]+/g, "").trim() || "registrations"} ${w.many}.csv`}
            />
          )}
          {current === "settings" && (
            <Card>
              <h2 className="text-lg font-semibold">Registration settings</h2>
              <p className="mt-1 mb-4 text-sm text-muted">What directors see and agree to when they register.</p>
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
                contactSaved={settingsDone}
                one={w.one}
              />
            </Card>
          )}
          {current === "invite" && (
            <Card>
              <h2 className="text-lg font-semibold">Invite directors</h2>
              <p className="mt-1 mb-6 text-sm text-muted">
                Optional. Bring in {w.many} you already work with, and email their directors an invitation to register.
              </p>
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
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
