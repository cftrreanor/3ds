import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/app/e/[slug]/auto-refresh";
import { SetupStep, StepStatus } from "@/components/setup-step";
import { getEventAccess, getOrigin } from "@/lib/data";
import { hasParents } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import { closesAtLabel, parentRegistrationClosed, type Child, type OtherAdult } from "@/lib/parents";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate, utcToZonedTime, zoneName } from "@/lib/time";
import { ActionButton, CopyLinkButton } from "../forms";
import { setParentCheckedIn, setParentRegistrationClosesAt, setParentRegistrationOpen, setParentWalkInsAllowed } from "./actions";
import { ClosesAtForm } from "./closes-at-form";
import { Door, type DoorParent } from "./door";
import { importParents } from "@/app/dashboard/import-actions";
import { SpreadsheetImport } from "@/components/spreadsheet-import";
import { GRADE_CHOICES, importFields } from "@/lib/imports";

export async function generateMetadata({ params }: PageProps<"/dashboard/events/[eventId]/parents">): Promise<Metadata> {
  const { eventId } = await params;
  return { title: (await getEventAccess(eventId)).isHost ? "Parent Registration" : "Parent check-in" };
}

/**
 * School visitor events. Hosts: Parent Registration, as setup steps (see
 * "Setup pages" in docs/DESIGN.md), then door check-in. The team: door check-in.
 */
export default async function ParentsDoorPage({ params }: PageProps<"/dashboard/events/[eventId]/parents">) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [{ data: event }, { data: allowed }, access] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, name, status, event_type, timezone, starts_on, ends_on, parent_registration_open, parent_registration_closes_at, parent_walk_ins_allowed")
      .eq("id", eventId)
      .maybeSingle(),
    supabase.rpc("can_check_in_parents", { ev: eventId }),
    getEventAccess(eventId),
  ]);
  if (!event) missing();
  if (!hasParents(event.event_type) || !allowed) redirect(`/dashboard/events/${eventId}`);

  const { data } = await supabase
    .from("parent_registrations")
    .select("id, parent_name, email, phone, children, other_adults, checked_in_at")
    .eq("event_id", eventId)
    .order("parent_name");
  const parents: DoorParent[] = (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    phone: r.phone,
    phoneDisplay: r.phone ? formatPhone(r.phone) : null,
    children: (r.children ?? []) as Child[],
    // The registering parent first, then everyone they named, each checked in on their own.
    adults: [
      { index: 0, name: r.parent_name, checkedIn: Boolean(r.checked_in_at) },
      ...((r.other_adults ?? []) as OtherAdult[]).map((a, i) => ({ index: i + 1, name: a.name, checkedIn: Boolean(a.checked_in_at) })),
    ],
  }));
  const childCount = parents.reduce((n, p) => n + p.children.length, 0);
  const adultCount = parents.reduce((n, p) => n + p.adults.length, 0);

  const today = utcToZonedDate(new Date().toISOString(), event.timezone);
  const over = today > event.ends_on;
  const isEventDay = today >= event.starts_on && !over;
  const link = `${await getOrigin()}/e/${event.slug}/parents`;
  const closed = parentRegistrationClosed(event);
  const closesAt = event.parent_registration_closes_at;
  const [qrSvg, qrPng] = access.isHost
    ? await Promise.all([
        QRCode.toString(link, { type: "svg", margin: 1, width: 160 }),
        QRCode.toDataURL(link, { margin: 2, width: 1024 }),
      ])
    : ["", ""];

  return (
    <div>
      {isEventDay && <AutoRefresh seconds={30} />}
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
        {access.isHost ? "Parent Registration" : "Parent check-in"}
      </h1>
      {access.isHost && (
        <p className="mt-2 text-sm text-muted">
          {parents.length} {parents.length === 1 ? "family" : "families"} registered · Registration {closed ? "closed" : "open"}
        </p>
      )}

      {access.isHost && (
        <div className="mt-6 flex flex-col gap-3">
          <SetupStep
            id="registration-settings"
            title="1. Registration settings"
            status={
              <StepStatus
                done={Boolean(closesAt)}
                doneLabel={`${closed === "deadline" ? "Closed" : "Closes"} ${closesAt ? closesAtLabel(closesAt, event.timezone) : ""}`}
                todoLabel="Optional"
              />
            }
            open={false}
            intro="When registration closes on its own, and whether parents who didn't register can still come."
          >
            {closed === "over" ? (
              <p className="text-sm text-muted">The event is over.</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium">
                    {closesAt
                      ? `${closed === "deadline" ? "Closed" : "Closes"} automatically ${closesAtLabel(closesAt, event.timezone)}`
                      : "Close automatically (optional)"}
                  </p>
                  <div className="mt-2">
                    <ClosesAtForm
                      action={setParentRegistrationClosesAt.bind(null, eventId, event.timezone)}
                      date={closesAt ? utcToZonedDate(closesAt, event.timezone) : ""}
                      time={closesAt ? utcToZonedTime(closesAt, event.timezone) : ""}
                      zone={`All times are ${zoneName(event.timezone)}`}
                      isSet={Boolean(closesAt)}
                    />
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium">Can parents who didn&apos;t register still attend?</p>
                  <p className="mt-1 text-sm text-muted">
                    {event.parent_walk_ins_allowed
                      ? "Yes. Once registration closes, the registration page tells parents they can still come with a valid government-issued photo ID during the event."
                      : "No. Once registration closes, the registration page tells parents to contact the school."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Walk-in parents">
                    {[true, false].map((allowed) =>
                      allowed === event.parent_walk_ins_allowed ? (
                        <span
                          key={String(allowed)}
                          className="inline-flex min-h-11 items-center rounded-md border-2 border-brand bg-brand-soft px-4 text-sm font-semibold"
                          aria-current="true"
                        >
                          ✓ {allowed ? "Yes, walk-ins can attend" : "No, registered parents only"}
                        </span>
                      ) : (
                        <ActionButton key={String(allowed)} action={setParentWalkInsAllowed.bind(null, eventId, allowed)} variant="secondary">
                          {allowed ? "Yes, walk-ins can attend" : "No, registered parents only"}
                        </ActionButton>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </SetupStep>

          <SetupStep
            id="open-registration"
            title="2. Open registration"
            status={
              closed === null ? (
                <StepStatus done doneLabel="Open" />
              ) : (
                <StepStatus
                  done={false}
                  todoLabel={
                    closed === "draft"
                      ? "Publish the event first"
                      : closed === "over"
                        ? "Event over"
                        : closed === "deadline"
                          ? "Closed automatically"
                          : parents.length > 0
                            ? "Closed"
                            : "Needs to be done"
                  }
                />
              )
            }
            open={closed === "draft" || (closed === "closed" && parents.length === 0)}
            intro="Share the link or QR code with families, then open registration so they can sign up."
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                {event.status !== "published" && (
                  <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
                    Publish the event from its main page first, then open registration here.
                  </p>
                )}
                {closed === "deadline" && closesAt && (
                  <p className="text-sm">
                    Registration closed on its own on {closesAtLabel(closesAt, event.timezone)}. To reopen it, change or
                    remove the closing time in step 1.
                  </p>
                )}
                <div>
                  <p className="text-sm font-medium">Registration link</p>
                  <p className="mt-1 break-all text-sm text-muted">{link}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyLinkButton url={link} label="Copy link" />
                    <a
                      href={`/e/${event.slug}/parents`}
                      target="_blank"
                      className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-background"
                    >
                      Preview page
                    </a>
                  </div>
                </div>
                {event.status === "published" && (closed === null || closed === "closed") && (
                  <ActionButton
                    action={setParentRegistrationOpen.bind(null, eventId, !event.parent_registration_open)}
                    variant={event.parent_registration_open ? "stop" : "go"}
                    confirmMessage={event.parent_registration_open ? "Close parent registration? Parents won't be able to register." : undefined}
                  >
                    {event.parent_registration_open ? "Close registration now" : "Open registration"}
                  </ActionButton>
                )}
                <p className="text-sm text-muted">
                  Parents get a reminder to bring their photo ID the day before. Children&apos;s details are deleted 30
                  days after the event{over ? `, on ${formatDate(addDays(event.ends_on, 31), { year: undefined })}` : ""}.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 self-center sm:self-start">
                <div
                  className="rounded-lg border border-border bg-white p-2"
                  aria-label="QR code for the registration link"
                  role="img"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <a href={qrPng} download={`${event.slug}-parent-registration-qr.png`} className="text-xs font-medium text-brand underline-offset-4 hover:underline">
                  Download QR code
                </a>
              </div>
            </div>
          </SetupStep>

          {closed !== "over" && (
            <SetupStep
              id="import-families"
              title="3. Import families"
              status={<StepStatus done={false} todoLabel="Optional" />}
              open={false}
              intro="Already collected registrations, like from a Google Form? Add them so they're on the check-in list. One row per child; rows with the same email become one family. Families already registered are left as they are."
            >
              <SpreadsheetImport
                kind="parents"
                fields={importFields("parents")}
                choices={{ grade: GRADE_CHOICES }}
                noun={{ one: "family", many: "families" }}
                templateName="parent-registrations.csv"
                emailOption="Email each family a confirmation with their link, a calendar invite and the photo ID reminder"
                action={importParents.bind(null, eventId)}
              />
            </SetupStep>
          )}
        </div>
      )}

      <section className={access.isHost ? "mt-10" : undefined} aria-label="Door check-in">
        {access.isHost && (
          <>
            <h2 className="text-xl font-semibold">Door check-in</h2>
            <p className="mt-1 text-sm text-muted">
              {parents.length} {parents.length === 1 ? "family" : "families"} · {adultCount} {adultCount === 1 ? "adult" : "adults"} ·{" "}
              {childCount} {childCount === 1 ? "child" : "children"}
            </p>
          </>
        )}
        <p className="mt-6 mb-4 leading-7 text-muted">
          Find the family, check each adult&apos;s <strong className="text-foreground">government-issued photo ID</strong>{" "}
          matches their name, then tap <strong className="text-foreground">Check in</strong> beside that person. Adults in a
          family can arrive at different times.{" "}
          {event.parent_walk_ins_allowed
            ? "Walk-ins are allowed at this event: anyone who isn't on the list goes through the school's usual visitor process with their photo ID."
            : "Anyone who isn't on the list goes through the school's usual visitor process."}
        </p>
        <Door parents={parents} toggle={setParentCheckedIn.bind(null, eventId)} />
      </section>
    </div>
  );
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
