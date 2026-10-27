import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { SettingsNav, type SettingsSection } from "./settings-nav";
import { TeamRoles } from "../team/team-roles";
import { EVENT_TYPES, eventTypeLabel, groupWords, leadWords, hasBands, hasBooths, hasConferences, hasEnsembles, hasParents, isMeeting } from "@/lib/event-types";
import { ActionButton } from "../forms";
import { getEventAccess } from "@/lib/data";
import { isPlacesConfigured } from "@/lib/places";
import { missing } from "@/lib/schema-check";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { brand as product } from "@/lib/brand";
import { isSchemaError } from "@/lib/schema-check";
import { saveReplies } from "../../../reply-actions";
import { RepliesForm } from "./replies-form";
import { saveNotifyRecipients } from "../../../notify-actions";
import { NotifyForm, type TeamMember } from "./notify-form";
import { MAX_EXTRA_EMAILS } from "@/lib/notify-recipients";
import { AUDIENCES, fileHref, fileMeta, isShowing, uploadedLines, type EventFile } from "@/lib/event-files";
import { formatDate, formatDateRange, utcToZonedTime, zoneName } from "@/lib/time";
import { setEventShowBrand, setEventType, updateEvent } from "../../../actions";
import { deleteFile, prepareUpload, saveFile } from "../../../file-actions";
import { FilesManager } from "./files-manager";
import { asksChildName, loadConferenceSettings } from "@/lib/conference-settings";
import { weeklySummary } from "@/lib/conferences";
import { displayTime } from "@/lib/schedule";
import { EventForm } from "../../_components/event-form";
import { SavedBy } from "@/components/saved-by";
import { LogoForm } from "@/components/logo-form";
import { loadBrand } from "@/lib/badges";

export const metadata: Metadata = { title: "Edit Event Details" };

const TYPE_SUMMARY = {
  band_contest: "Bands register, get performance times, and are checked in on contest day, alongside your volunteers.",
  group_event: "Groups (choirs, orchestras, teams, and more) register and move through your rooms on a schedule worked out for them, alongside your volunteers.",
  volunteer: "Volunteers, shifts, check-in, and your team only. No band registration or performance schedule.",
  school_visit: "Parents register their children ahead and are checked in at the door with a photo ID, alongside your volunteers. Children's details are seen only by your team and permanently deleted 30 days after the event.",
  conference: "Families book a meeting time with you, in person, on video, or by phone. Free during the pilot, with one published conference at a time.",
  meeting: "People book a time with you, in person, on video, or by phone, and can bring up to three others.",
};

// What switching to each kind adds or removes.
const SWITCH_NOTE = {
  band_contest: "Band registration, the performance schedule, and contest day check-in are added.",
  group_event: "Group registration, rooms, and each group's room schedule are added; the single performance order and band check-in stations go away.",
  volunteer: "Band registration, parent registration, and the performance schedule go away; band check-in stations become ordinary stations.",
  school_visit: "Parent registration and door check-in are added (children's details are deleted 30 days after the event); band registration and the performance schedule go away.",
  fair: "Booths and partners by zone, partner check-in, and the public \u201cWhat's at the event\u201d list are added; band registration and the performance schedule go away.",
};

/**
 * Set up or edit an event's global settings: a section menu with one panel at
 * a time (?section=details, files, team, or emails). Type-specific setup
 * (bands, stations, conference times) stays on its own pages. Old ?step=
 * links still land in the right section.
 */
export default async function EditEventPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/edit">) {
  const { eventId } = await params;
  const { step, section: sectionParam, tab } = await searchParams;
  const access = await getEventAccess(eventId);
  if (!access.isHost) redirect(`/dashboard/events/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organization_id, name, status, event_type, created_by, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, venue_place_id, venue_lat, venue_lng",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  const SECTIONS = ["details", "files", "team", "emails"] as const;
  type Section = (typeof SECTIONS)[number];
  const fromStep: Record<string, Section> = { files: "files", kind: "details", replies: "emails", notifications: "emails" };
  const section: Section =
    SECTIONS.find((x) => x === sectionParam) ?? (typeof step === "string" ? fromStep[step] : undefined) ?? "details";
  // The account's logo for volunteer badges lives with the other uploads, here.
  const badgesHere = !hasConferences(event.event_type);
  const askChildName = hasConferences(event.event_type) ? await asksChildName(supabase, eventId) : true;
  // Conferences and meetings: the day or weekly hours, as set in their setup page.
  const setup = hasConferences(event.event_type) ? (await loadConferenceSettings(supabase, eventId)).settings : null;
  const when = setup
    ? {
        summary: `${
          setup.schedule === "weekly"
            ? `Every week: ${weeklySummary(setup.weekly_hours)} · ${formatDateRange(event.starts_on, event.ends_on)}`
            : `${formatDate(event.starts_on)} · ${displayTime(utcToZonedTime(event.window_start, event.timezone))} – ${displayTime(utcToZonedTime(event.window_end, event.timezone))}`
        } · ${zoneName(event.timezone)}`,
        href: `/dashboard/events/${eventId}/conferences#times`,
        setupName: isMeeting(event.event_type) ? "Meeting Setup" : "Conference Setup",
      }
    : undefined;
  // One logo and color per account; each event can switch them off (true until the 20261220000000 update).
  const [brand, showBrand] = await Promise.all([
    loadBrand(event.organization_id),
    supabase
      .from("events")
      .select("show_brand")
      .eq("id", eventId)
      .maybeSingle()
      .then((r) => (r.data as { show_brand?: boolean } | null)?.show_brand !== false),
  ]);
  const hasBrand = Boolean(brand.logo || brand.color);
  const brandSwitch = hasBrand ? (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        <span className="font-semibold">{showBrand ? "Shown on this event" : "Off for this event"}</span>
        <span className="block text-muted">
          {showBrand
            ? "This event's public pages show your logo and color."
            : "This event's public pages use the standard look, without your logo or color."}
        </span>
      </p>
      <ActionButton action={setEventShowBrand.bind(null, eventId, !showBrand)} variant="secondary">
        {showBrand ? "Hide on this event" : "Show on this event"}
      </ActionButton>
    </div>
  ) : null;
  const [{ count }, { data: fileData }, { count: bandCount }, { count: parentCount }, { count: boothCount }] = await Promise.all([
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase
      .from("event_files")
      .select("id, event_id, label, path, file_name, content_type, size_bytes, audiences, visible_from, uploaded_by, uploaded_at")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("bands").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("parent_registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("fair_booths").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  // Email replies: who the emails show as from, and where replies go (lib/event-sender).
  const admin = createAdminClient();
  const [{ data: replyRow, error: replyError }, { data: creator }, { data: org }] = await Promise.all([
    supabase.from("event_email_settings").select("replies, reply_to").eq("event_id", eventId).maybeSingle(),
    event.created_by ? admin.from("profiles").select("full_name, email").eq("id", event.created_by).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("organizations").select("name").eq("id", event.organization_id).maybeSingle(),
  ]);
  const conference = hasConferences(event.event_type);
  // Notifications: bookings (conferences and meetings) and withdrawals (bands and groups) go to the people picked here.
  const notifyHere = conference || hasEnsembles(event.event_type);
  const [{ data: memberRows }, { data: notifyRow, error: notifyError }] = notifyHere
    ? await Promise.all([
        admin.from("organization_members").select("user_id, role, profiles(full_name, email)").eq("organization_id", event.organization_id),
        supabase.from("event_notification_recipients").select("member_ids, extra_emails").eq("event_id", eventId).maybeSingle(),
      ])
    : [{ data: null }, { data: null, error: null }];
  const members: TeamMember[] = ((memberRows ?? []) as unknown as { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | null }[])
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.full_name?.trim() || m.profiles?.email || "Someone on your account",
      email: m.profiles?.email ?? null,
      role: m.role === "owner" ? "Account Host" : "Co-host",
    }))
    .sort((a, b) => Number(b.role === "Account Host") - Number(a.role === "Account Host"));
  // Not saved yet: who gets them today (the teacher for bookings; every host for band and group alerts).
  const notifyPicked = notifyRow
    ? (notifyRow.member_ids as string[])
    : conference
      ? members.filter((m) => m.id === event.created_by).map((m) => m.id)
      : members.map((m) => m.id);
  const senderName = (conference ? creator?.full_name?.trim() : org?.name?.trim()) || org?.name?.trim() || "";
  const repliesOn = replyRow ? replyRow.replies : true;
  const replyTo = replyRow?.reply_to || (creator?.email as string | undefined) || "";
  const repliesUnavailable = isSchemaError(replyError);
  const bandsHere = hasBands(event.event_type);
  const groupsHere = hasEnsembles(event.event_type);
  const words = groupWords(event.event_type);
  const fileRows = (fileData ?? []) as (EventFile & { uploaded_by: string | null; uploaded_at: string })[];
  const uploaded = await uploadedLines(fileRows, event.timezone);
  const files = fileRows.map((f) => ({
    id: f.id,
    label: f.label,
    meta: fileMeta(f),
    audiences: f.audiences,
    visibleFrom: f.visible_from,
    hiddenNote: isShowing(f, event.timezone) ? null : `Hidden until ${formatDate(f.visible_from!, { year: undefined })}`,
    href: fileHref(f.id),
    uploaded: uploaded.get(f.id) ?? null,
  }));

  // Team: how many co-hosts and Volunteer Leads, for the menu.
  const [{ count: coHostCount }, { count: leadCount }] = await Promise.all([
    supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", event.organization_id).eq("role", "admin"),
    supabase.from("event_staff").select("user_id", { count: "exact", head: true }).eq("event_id", eventId).eq("role", "volunteer_director"),
  ]);
  const teamCount = (coHostCount ?? 0) + (conference ? 0 : (leadCount ?? 0));
  const base = `/dashboard/events/${eventId}/edit`;
  const sections: SettingsSection[] = [
    { id: "details", label: "Event details", done: true, status: eventTypeLabel(event.event_type) },
    { id: "files", label: "Maps & documents", done: files.length > 0, status: files.length ? `${files.length} ${files.length === 1 ? "file" : "files"}` : "Optional" },
    { id: "team", label: "Team setup", done: teamCount > 0, status: teamCount ? `${teamCount} ${teamCount === 1 ? "person" : "people"}` : "Optional" },
    { id: "emails", label: "Email settings", done: Boolean(replyRow || notifyRow), status: replyRow || notifyRow ? "Saved" : "Default" },
  ];
  const published = event.status === "published";

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">{published ? "Edit Event Details" : "Set Up Your Event"}</h1>
      <SavedBy eventId={eventId} area={["details", "files"]} className="mt-2" />
      <div className="mt-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
        <SettingsNav sections={sections} current={section} base={base} />
        <div id="settings-panel" className="min-w-0 space-y-6">
          {section === "details" && (
            <>
              <Panel
                title="Event details"
                intro={when ? `The name and time zone everyone sees. The day or weekly hours are set in ${when.setupName}.` : "The name, dates, times, and venue everyone sees."}
              >
                <EventForm
                  action={updateEvent.bind(null, eventId)}
                  organizationId={event.organization_id}
                  initial={{
                    name: event.name,
                    startsOn: event.starts_on,
                    endsOn: event.ends_on,
                    startTime: utcToZonedTime(event.window_start, event.timezone),
                    endTime: utcToZonedTime(event.window_end, event.timezone),
                    timezone: event.timezone,
                    venue: {
                      name: event.venue_name,
                      address: event.venue_address,
                      placeId: event.venue_place_id,
                      lat: event.venue_lat,
                      lng: event.venue_lng,
                    },
                    askChildName,
                  }}
                  venueSearchEnabled={isPlacesConfigured}
                  submitLabel="Save changes"
                  hasShifts={(count ?? 0) > 0}
                  eventType={event.event_type}
                  when={when}
                />
              </Panel>

              {badgesHere && (
                <Panel id="logo" title="Logo and color">
                  <p className="text-sm text-muted">
                    One logo for your account, shown next to ours at the top of your public event pages and printed on volunteer
                    badges. Print badges from{" "}
                    <Link href={`/dashboard/events/${eventId}/volunteering/badges`} className="font-medium text-brand underline">
                      Volunteer Setup
                    </Link>
                    .
                  </p>
                  <div className="mt-3">
                    <LogoForm eventId={eventId} logo={brand.logo} color={brand.color} />
                  </div>
                  {brandSwitch}
                </Panel>
              )}
              {/* Conferences don't set the logo here, but can switch off the one the account has. */}
              {!badgesHere && hasBrand && (
                <Panel id="logo" title="Your account's logo and color" intro="Set on your account's other events. You can leave them off this one.">
                  {brandSwitch}
                </Panel>
              )}

              <Panel id="kind" title="Kind of event" intro="What the event is for decides which pages and tools it has.">
                <div className="space-y-3">
                  <p>
                    This is {isMeeting(event.event_type) ? "for " : "a "}<strong>{event.event_type === "conference" ? "parent-teacher conference" : eventTypeLabel(event.event_type).toLowerCase()}</strong>.{" "}
                    <span className="text-muted">{TYPE_SUMMARY[event.event_type as keyof typeof TYPE_SUMMARY] ?? TYPE_SUMMARY.band_contest}</span>
                  </p>
                  {hasConferences(event.event_type) ? (
                    <p className="text-sm text-muted">
                      {isMeeting(event.event_type) ? "Meetings stay meetings" : "A conference stays a conference"}. For another kind of event, create a new one.
                    </p>
                  ) : groupsHere && (bandCount ?? 0) > 0 ? (
                    <p className="text-sm text-muted">
                      {bandCount} {bandCount === 1 ? `${words.one} has` : `${words.many} have`} registered, so this has to stay a{" "}
                      {eventTypeLabel(event.event_type).toLowerCase()}.
                    </p>
                  ) : hasBooths(event.event_type) && (boothCount ?? 0) > 0 ? (
                    <p className="text-sm text-muted">This fair has booths and partners, so it has to stay a school fair.</p>
                  ) : hasParents(event.event_type) && (parentCount ?? 0) > 0 ? (
                    <p className="text-sm text-muted">
                      {parentCount} parent{parentCount === 1 ? " has" : "s have"} registered, so this has to stay a school visitor event.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {EVENT_TYPES.filter((t) => t.value !== (event.event_type ?? "band_contest") && !hasConferences(t.value)).map((t) => (
                        <ActionButton
                          key={t.value}
                          action={setEventType.bind(null, eventId, t.value)}
                          variant="secondary"
                          confirmMessage={`Make this a ${t.label.toLowerCase()}? ${SWITCH_NOTE[t.value as keyof typeof SWITCH_NOTE]} Volunteers and shifts stay as they are.`}
                        >
                          Make it a {t.label.toLowerCase()}
                        </ActionButton>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            </>
          )}

          {section === "files" && (
            <Panel
              title="Maps & documents"
              intro={
                groupsHere
                  ? `Share a ${bandsHere ? "stadium" : "building"} map, parking map, or director packet. Choose who sees each one: the public page, ${words.one} directors, volunteers, or your team.`
                  : "Share a site map, parking map, or volunteer guide. Choose who sees each one: the public page, volunteers, or your team."
              }
            >
              <FilesManager
                files={files}
                audiences={groupsHere ? AUDIENCES : AUDIENCES.filter((a) => a.value !== "directors")}
                prepareUpload={prepareUpload.bind(null, eventId)}
                saveFile={saveFile.bind(null, eventId)}
                deleteFile={deleteFile.bind(null, eventId)}
                canNotify={bandsHere}
              />
            </Panel>
          )}

          {section === "team" && (
            <div>
              <h2 className="text-xl font-semibold">Team setup</h2>
              <p className="mb-4 mt-1 text-sm text-muted">
                {conference
                  ? "Co-hosts share your account: they can see your bookings, and reschedule or cancel meetings."
                  : `Everyone helping you run ${event.name}. ${leadWords(event.event_type).many} are invited in Volunteer Setup, next to the stations they lead.`}
              </p>
              <TeamRoles eventId={eventId} roles={conference ? ["hosts"] : ["hosts", "volunteer-leads"]} open={typeof tab === "string" ? tab : null} />
            </div>
          )}

          {section === "emails" && (
            <>
              <Panel
                title="Email replies"
                intro={`Emails about this event show as from \u201c${senderName ? `${senderName} via ` : ""}${product.name}\u201d. Choose whether people can reply to them.`}
              >
                {repliesUnavailable ? (
                  <p className="text-sm text-muted">
                    A database update is needed before replies can be set up. See “Applying database updates” in the setup guide.
                  </p>
                ) : (
                  <RepliesForm
                    action={saveReplies.bind(null, eventId)}
                    replies={repliesOn}
                    replyTo={replyTo}
                    who={
                      conference
                        ? "Families"
                        : groupsHere
                          ? `${words.one[0].toUpperCase()}${words.one.slice(1)} directors and volunteers`
                          : hasParents(event.event_type)
                            ? "Families and volunteers"
                            : "Volunteers"
                    }
                  />
                )}
              </Panel>

              {notifyHere && (
                <Panel
                  id="notifications"
                  title="Who gets notifications"
                  intro={
                    conference
                      ? "Who gets an email, with a calendar invite, when someone books, changes, or cancels a meeting."
                      : `Who gets an email when a ${words.one} withdraws.`
                  }
                >
                  {isSchemaError(notifyError) ? (
                    <p className="text-sm text-muted">
                      A database update is needed before notifications can be set up. See “Applying database updates” in the setup guide.
                    </p>
                  ) : (
                    <>
                      <NotifyForm
                        action={saveNotifyRecipients.bind(null, eventId)}
                        members={members}
                        picked={notifyPicked}
                        extraEmails={notifyRow?.extra_emails ?? []}
                        max={MAX_EXTRA_EMAILS}
                      />
                      <p className="mt-3 text-sm text-muted">
                        Someone missing?{" "}
                        <Link href={`${base}?section=team`} className="font-medium text-brand underline">
                          Add them in Team setup
                        </Link>
                        .
                      </p>
                    </>
                  )}
                </Panel>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** One titled card in a settings section. */
function Panel({ id, title, intro, children }: { id?: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}
