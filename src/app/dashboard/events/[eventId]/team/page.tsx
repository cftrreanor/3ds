import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEventAccess, getOrigin } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { cancelInvitation, inviteMember, removeCoHost, removeMember } from "../../../team-actions";
import { CopyLinkButton, DeleteButton, InviteForm, RemoveButton } from "../forms";

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

  const [{ data: staff }, { data: invitationData }, { data: stationData }, { data: leadRows }, { data: hostData }] =
    await Promise.all([
      supabase.from("event_staff").select("user_id, role, profiles(full_name, email, phone)").eq("event_id", eventId).order("created_at"),
      supabase
        .from("invitations")
        .select("id, email, role, as_host, station_id, token, expires_at")
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

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Team</h1>
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
            <p className="text-sm leading-6 text-muted">
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
            <p className="text-sm leading-6 text-muted">
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
            <p className="text-sm leading-6 text-muted">
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
              <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm leading-6">
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

        {pending.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold">Waiting to accept</h2>
            <ul className="mt-2 space-y-2">
              {pending.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                    <p className="text-sm text-muted">
                      {[stationName(inv.station_id), new Date(inv.expires_at) < new Date() ? "Expired" : "Invited"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <CopyLinkButton url={`${origin}/invite/${inv.token}`} />
                    {(access.isHost || inv.role === "section_lead") && (
                      <DeleteButton
                        action={cancelInvitation.bind(null, eventId, inv.id)}
                        label={`Cancel invitation for ${inv.email}`}
                        confirmMessage={`Cancel the invitation for ${inv.email}?`}
                        text="Cancel"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(access.isHost || tab === "section-leads") && (
          <details className="rounded-lg border border-border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">
              {tab === "hosts" ? "Invite a co-host" : tab === "volunteer-leads" ? "Invite a Volunteer Lead" : "Invite a Section Lead"}
            </summary>
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-6 text-muted">
                We&apos;ll create a private link. Send it to them by text or email; they sign in with the email you enter
                here to join.
              </p>
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
          </details>
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
