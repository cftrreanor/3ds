import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEventAccess, getOrigin } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { cancelInvitation, inviteMember, reinviteMember, removeCoHost, removeMember, resendInvitation } from "../../../team-actions";
import { CopyLinkButton, DeleteButton, InviteForm, RemoveButton, SmallActionButton } from "../forms";

export const metadata: Metadata = { title: "Team" };

type Person = { full_name: string; email: string; phone: string | null } | null;
type StaffRow = { user_id: string; role: "volunteer_director" | "section_lead"; profiles: Person };
type HostRow = { user_id: string; role: "owner" | "admin"; profiles: Person };
type Invitation = {
  id: string;
  email: string;
  role: "volunteer_director" | "section_lead" | null;
  as_host: boolean;
  station_id: string | null;
  token: string;
  expires_at: string;
  sent_at: string | null;
};
type Removal = {
  id: string;
  role: "co_host" | "volunteer_director" | "section_lead";
  user_id: string;
  email: string;
  full_name: string;
  removed_by: string | null;
  removed_at: string;
};
type Tab = "hosts" | "volunteer-leads" | "section-leads";

const HOST_LABEL = { owner: "Host", admin: "Co-host" } as const;

/** Hosts & co-hosts, Volunteer Leads and Section Leads, one tab each. */
export default async function TeamPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/team">) {
  const { eventId } = await params;
  const { tab: tabParam } = await searchParams;
  const access = await getEventAccess(eventId);
  if (!access.canManage) redirect(`/dashboard/events/${eventId}`);
  const user = await requireUser();
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, organization_id, name").eq("id", eventId).maybeSingle();
  if (!event) missing();

  const [{ data: staff }, { data: invitationData }, { data: stationData }, { data: leadRows }, { data: hostData }, { data: removalData }] =
    await Promise.all([
      supabase.from("event_staff").select("user_id, role, profiles(full_name, email, phone)").eq("event_id", eventId).order("created_at"),
      supabase
        .from("invitations")
        .select("id, email, role, as_host, station_id, token, expires_at, sent_at")
        .eq("event_id", eventId)
        .is("accepted_at", null)
        .order("created_at"),
      supabase.from("stations").select("id, name").eq("event_id", eventId).order("sort_order").order("created_at"),
      supabase.from("station_leads").select("station_id, user_id").eq("event_id", eventId).order("created_at"),
      // Only hosts can read the organization's members.
      access.isHost
        ? supabase
            .from("organization_members")
            .select("user_id, role, profiles(full_name, email, phone)")
            .eq("organization_id", event.organization_id)
            .order("created_at")
        : Promise.resolve({ data: [] }),
      // Removed co-hosts (whole organization) and removed leads (this event). RLS limits what you see.
      supabase
        .from("team_removals")
        .select("id, role, user_id, email, full_name, removed_by, removed_at")
        .or(`event_id.eq.${eventId},and(role.eq.co_host,organization_id.eq.${event.organization_id})`)
        .order("removed_at", { ascending: false }),
    ]);
  const staffRows = (staff ?? []) as unknown as StaffRow[];
  const hosts = ((hostData ?? []) as unknown as HostRow[]).sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  const directors = staffRows.filter((s) => s.role === "volunteer_director");
  const leads = staffRows.filter((s) => s.role === "section_lead");
  const invitations = (invitationData ?? []) as Invitation[];
  const stations = (stationData ?? []).map((st) => ({
    ...st,
    lead_ids: (leadRows ?? []).filter((l) => l.station_id === st.id).map((l) => l.user_id),
  }));
  const unled = stations.filter((s) => s.lead_ids.length === 0);
  const origin = await getOrigin();

  const tabs: { id: Tab; label: string; count: number }[] = [
    ...(access.isHost ? [{ id: "hosts" as const, label: "Hosts", count: hosts.length }] : []),
    { id: "volunteer-leads", label: "Volunteer Leads", count: directors.length },
    { id: "section-leads", label: "Section Leads", count: leads.length },
  ];
  const tab = tabs.find((t) => t.id === tabParam)?.id ?? tabs[0].id;
  const pending = invitations.filter((inv) =>
    tab === "hosts" ? inv.as_host : tab === "volunteer-leads" ? inv.role === "volunteer_director" : inv.role === "section_lead",
  );
  const stationName = (id: string | null) => stations.find((s) => s.id === id)?.name;
  const tabRole = tab === "hosts" ? "co_host" : tab === "volunteer-leads" ? "volunteer_director" : "section_lead";
  // Not people who are back, or who already have an invitation waiting.
  const current = new Set((tab === "hosts" ? hosts : tab === "volunteer-leads" ? directors : leads).map((m) => m.user_id));
  const removed = ((removalData ?? []) as Removal[]).filter(
    (r) => r.role === tabRole && !current.has(r.user_id) && !pending.some((inv) => inv.email.toLowerCase() === r.email.toLowerCase()),
  );
  // Volunteer Leads manage Section Leads; hosts manage everyone.
  const canInvite = access.isHost || tab === "section-leads";
  const roleName = tab === "hosts" ? "co-host" : tab === "volunteer-leads" ? "Volunteer Lead" : "Section Lead";

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Team</h1>
      <p className="mt-1 text-muted">Everyone helping you run {event.name}.</p>

      <nav aria-label="Team roles" className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-border">
          {tabs.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/events/${eventId}/team?tab=${t.id}`}
                scroll={false}
                aria-current={t.id === tab ? "page" : undefined}
                className={`-mb-px flex flex-col border-b-2 px-4 py-2 text-sm ${
                  t.id === tab ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                <span className="whitespace-nowrap">{t.label}</span>
                <span className="text-xs font-normal tabular-nums text-muted">
                  {t.count} {t.count === 1 ? "person" : "people"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="mt-6 space-y-6">
        {tab === "hosts" && (
          <div>
            <h2 className="text-sm font-semibold">Current members</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Hosts and co-hosts have full access to all of your organization&apos;s events: publishing, bands, the
              schedule, volunteers and the team.
            </p>
            <ul className="mt-3 space-y-2">
              {hosts.map((h) => (
                <PersonRow key={h.user_id} person={h.profiles} isYou={h.user_id === user.id} detail={HOST_LABEL[h.role]}>
                  {h.role === "admin" && (
                    <RemoveButton
                      action={removeCoHost.bind(null, eventId, h.user_id)}
                      label={h.user_id === user.id ? "Stop being a co-host" : "Remove co-host"}
                      confirmMessage={
                        h.user_id === user.id
                          ? "Stop being a co-host? You'll lose access to all of this organization's events."
                          : "Remove this co-host? They'll lose access to all of your organization's events."
                      }
                    />
                  )}
                </PersonRow>
              ))}
            </ul>
          </div>
        )}

        {tab === "volunteer-leads" && (
          <div>
            <h2 className="text-sm font-semibold">Current members</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Volunteer Leads run volunteers with you: stations, shifts, signups and check-in. They can invite Section
              Leads.
            </p>
            {directors.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {directors.map((d) => (
                  <PersonRow key={d.user_id} person={d.profiles} isYou={d.user_id === user.id}>
                    {access.isHost && (
                      <RemoveButton
                        action={removeMember.bind(null, eventId, d.user_id, d.role)}
                        label="Remove Volunteer Lead"
                        confirmMessage="Remove this Volunteer Lead from the event?"
                      />
                    )}
                  </PersonRow>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                None yet. You&apos;re running volunteers yourself as the host. Invite one or more Volunteer Leads below to
                share the work.
              </p>
            )}
          </div>
        )}

        {tab === "section-leads" && (
          <div>
            <h2 className="text-sm font-semibold">Current members</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Section Leads run one station on the day, like Parking. They see who&apos;s on their shifts; phone numbers
              unlock on event day.
            </p>
            {leads.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {leads.map((l) => {
                  const led = stations.filter((s) => s.lead_ids.includes(l.user_id)).map((s) => s.name);
                  return (
                    <PersonRow
                      key={l.user_id}
                      person={l.profiles}
                      isYou={l.user_id === user.id}
                      detail={led.length ? `Leads ${led.join(", ")}` : "No station yet"}
                    >
                      <RemoveButton
                        action={removeMember.bind(null, eventId, l.user_id, l.role)}
                        label="Remove Section Lead"
                        confirmMessage="Remove this Section Lead from the event? They'll be taken off their stations."
                      />
                    </PersonRow>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">None yet.</p>
            )}
            {unled.length > 0 && (
              <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm leading-6">
                <span className="font-medium">No lead yet:</span>{" "}
                {unled.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/dashboard/events/${eventId}/volunteering?station=${s.id}`}
                      className="text-brand underline-offset-4 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </span>
                ))}
                . Invite someone below, or pick a lead in the station&apos;s settings.
              </p>
            )}
          </div>
        )}

        <section>
          <h2 className="text-sm font-semibold">Pending</h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No invitations waiting.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {pending.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                const mine = access.isHost || inv.role === "section_lead";
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.email}</p>
                      <p className="text-sm text-muted">
                        {[
                          stationName(inv.station_id),
                          expired ? "Expired" : inv.sent_at ? `Sent ${formatDate(inv.sent_at.slice(0, 10))}` : "Not emailed yet",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {mine && (
                        <SmallActionButton action={resendInvitation.bind(null, eventId, inv.id)} label={`Resend invitation to ${inv.email}`}>
                          {inv.sent_at ? "Resend" : "Send"}
                        </SmallActionButton>
                      )}
                      <CopyLinkButton url={`${origin}/invite/${inv.token}`} label="Copy link" />
                      {mine && (
                        <DeleteButton
                          action={cancelInvitation.bind(null, eventId, inv.id)}
                          label={`Cancel invitation for ${inv.email}`}
                          confirmMessage={`Cancel the invitation for ${inv.email}?`}
                          text="Cancel"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canInvite && (
          <section>
            <h2 className="text-sm font-semibold">Invite a {roleName}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              We&apos;ll email them an invitation. One tap accepts it and sets up their account; no password needed.
            </p>
            <div className="mt-3">
              <InviteForm
                key={tab}
                action={inviteMember.bind(null, eventId)}
                roles={[
                  tab === "hosts"
                    ? { value: "host", label: "Co-host" }
                    : tab === "volunteer-leads"
                      ? { value: "volunteer_director", label: "Volunteer Lead" }
                      : { value: "section_lead", label: "Section Lead" },
                ]}
                stations={stations.map((s) => ({ id: s.id, name: s.name }))}
              />
            </div>
          </section>
        )}

        {removed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold">Removed</h2>
            <ul className="mt-2 space-y-2">
              {removed.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-muted">{r.full_name || r.email}</p>
                    <p className="text-sm text-muted">
                      {[r.full_name ? r.email : null, `${r.removed_by === r.user_id ? "Left" : "Removed"} ${formatDate(r.removed_at.slice(0, 10))}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {canInvite && (
                    <SmallActionButton action={reinviteMember.bind(null, eventId, r.id)} label={`Re-invite ${r.email}`}>
                      Re-invite
                    </SmallActionButton>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </Card>
    </div>
  );
}

function PersonRow({
  person,
  isYou,
  detail,
  children,
}: {
  person: Person;
  isYou: boolean;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {person?.full_name || person?.email || "Team member"}
          {isYou && <span className="font-normal text-muted"> (you)</span>}
        </p>
        <p className="text-sm text-muted">
          {[person?.email, formatPhone(person?.phone), detail].filter(Boolean).join(" · ")}
        </p>
      </div>
      {children}
    </li>
  );
}
