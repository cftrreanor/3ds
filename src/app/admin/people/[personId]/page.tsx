import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ, ago, authActionLabel, byNewest, personRoles, ROLE_LABEL, stageLabel, stamp, type TimelineItem } from "@/lib/admin-crm";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { NOTE_COLUMNS, signIns, type EmailRow, type NoteRow } from "../../data";
import { Facts, PageHeader, Panel, RecordLink, Tag } from "../../kit";
import { NoteComposer } from "../../note-composer";
import { addNote } from "../../notes-actions";
import { emailItems, noteItems, Timeline } from "../../timeline";

export const metadata: Metadata = { title: "Person" };

type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  organization_members: { role: string; organizations: { id: string; name: string } | null }[];
  event_staff: { role: string; events: { name: string; starts_on: string; organizations: { id: string; name: string } | null } | null }[];
  bands: { id: string; school_name: string; band_name: string; created_at: string; events: { name: string; starts_on: string; organizations: { id: string; name: string } | null } | null }[];
};

const STAFF_ROLE: Record<string, string> = { volunteer_director: "Volunteer Lead", section_lead: "Section Lead" };

/** One person: their roles, sign-ins, the emails we sent them, and notes. */
export default async function PersonPage({ params }: PageProps<"/admin/people/[personId]">) {
  await requirePlatformAdmin();
  const { personId } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, phone, created_at, organization_members(role, organizations(id, name)), event_staff(role, events(name, starts_on, organizations(id, name))), bands!bands_director_user_id_fkey(id, school_name, band_name, created_at, events(name, starts_on, organizations(id, name)))",
    )
    .eq("id", personId)
    .maybeSingle();
  if (!data) missing();
  const p = data as unknown as Profile;

  const [{ data: emailData }, { data: noteData }, { data: requestData }, { data: isAdmin }, history, logins] = await Promise.all([
    admin.from("email_log").select("*").eq("to_email", p.email).order("created_at", { ascending: false }).limit(100),
    admin.from("admin_notes").select(NOTE_COLUMNS).eq("profile_id", p.id).order("created_at", { ascending: false }),
    admin.from("pilot_requests").select("id, organization, status, created_at").ilike("email", p.email.replace(/[\\%_]/g, (c) => `\\${c}`)),
    admin.from("platform_admins").select("user_id").eq("user_id", p.id).maybeSingle(),
    (await createClient()).rpc("admin_auth_history", { p_user: p.id, p_limit: 50 }),
    signIns(),
  ]);
  const login = logins.get(p.id);
  const auth = (history.data ?? []) as { at: string; action: string }[];
  const requests = (requestData ?? []) as { id: string; organization: string; status: string; created_at: string }[];
  const roles = personRoles(p);
  const today = utcToZonedDate(new Date().toISOString(), ADMIN_TZ);

  const items: TimelineItem[] = [
    { at: p.created_at, kind: "account", title: "Created their account" },
    ...auth.map((a) => ({ at: a.at, kind: "signin" as const, title: authActionLabel(a.action) })),
    ...requests.map((r) => ({
      at: r.created_at,
      kind: "pipeline" as const,
      title: `Asked to join the pilot (${r.organization})`,
      detail: `Stage: ${stageLabel(r.status)}`,
      href: `/admin/pipeline/${r.id}`,
    })),
    ...p.bands.map((b) => ({
      at: b.created_at,
      kind: "event" as const,
      title: `Registered ${b.school_name} ${b.band_name}`,
      detail: b.events ? `${b.events.name}${b.events.organizations ? ` · ${b.events.organizations.name}` : ""}` : null,
    })),
    ...noteItems((noteData ?? []) as unknown as NoteRow[]),
    ...emailItems((emailData ?? []) as EmailRow[]),
  ];
  items.sort(byNewest);
  // The account's own "created" entry duplicates Supabase's sign-up record when both exist.
  const timeline = auth.some((a) => a.action === "user_signedup") ? items.filter((i) => i.title !== "Created their account") : items;

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/admin/people" className="text-muted hover:text-foreground">
          ← People
        </Link>
      </p>
      <PageHeader
        title={p.full_name || p.email}
        sub={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a href={`mailto:${p.email}`} className="text-brand underline underline-offset-4">
              {p.email}
            </a>
            {p.phone && <span>{formatPhone(p.phone)}</span>}
            {isAdmin && <Tag tone="brand">FieldCommand admin</Tag>}
            {roles.map((r) => (
              <Tag key={r}>{ROLE_LABEL[r]}</Tag>
            ))}
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Panel title="Timeline" flush>
            <div className="border-b border-border p-3">
              <NoteComposer action={addNote.bind(null, { profileId: p.id })} />
            </div>
            <Timeline items={timeline} today={today} />
            {history.error && <p className="border-t border-border px-3 py-2 text-xs text-muted">Sign-in history isn&apos;t available right now.</p>}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Account">
            <Facts
              items={[
                ["Joined", formatDate(utcToZonedDate(p.created_at, ADMIN_TZ), { weekday: undefined })],
                ["Email confirmed", login?.email_confirmed_at ? stamp(login.email_confirmed_at) : "Not yet"],
                ["Last sign-in", login?.last_sign_in_at ? <span title={stamp(login.last_sign_in_at)}>{ago(login.last_sign_in_at)}</span> : "Never"],
              ]}
            />
          </Panel>
          <Panel title="Hosts">
            {p.organization_members.length ? (
              <ul className="space-y-1 text-sm">
                {p.organization_members.map((m) => (
                  <li key={m.organizations?.id} className="flex items-baseline justify-between gap-2">
                    {m.organizations ? <RecordLink href={`/admin/accounts/${m.organizations.id}`}>{m.organizations.name}</RecordLink> : "—"}
                    <span className="text-xs text-muted">{m.role === "owner" ? "Owner" : "Co-host"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Not a host.</p>
            )}
          </Panel>
          <Panel title="Event teams">
            {p.event_staff.length ? (
              <ul className="space-y-1.5 text-sm">
                {p.event_staff.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{s.events?.name}</span>
                    <span className="text-muted"> · {STAFF_ROLE[s.role] ?? s.role}</span>
                    {s.events?.organizations && (
                      <p className="text-xs">
                        <RecordLink href={`/admin/accounts/${s.events.organizations.id}`}>{s.events.organizations.name}</RecordLink>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Not on any event team.</p>
            )}
          </Panel>
          <Panel title="Bands and groups">
            {p.bands.length ? (
              <ul className="space-y-1.5 text-sm">
                {p.bands.map((b) => (
                  <li key={b.id}>
                    <span className="font-medium">
                      {b.school_name} {b.band_name}
                    </span>
                    {b.events && (
                      <p className="text-xs text-muted">
                        {b.events.name} · {formatDate(b.events.starts_on, { year: undefined })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Hasn&apos;t registered a band or group.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
