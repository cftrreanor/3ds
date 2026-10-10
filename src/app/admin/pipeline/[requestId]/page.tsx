import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ, byNewest, STAGES, stageLabel, type TimelineItem } from "@/lib/admin-crm";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { NOTE_COLUMNS, type EmailRow, type NoteRow } from "../../data";
import { Facts, PageHeader, Panel, RecordLink, Tag } from "../../kit";
import { NoteComposer } from "../../note-composer";
import { addNote, moveStage } from "../../notes-actions";
import { emailItems, noteItems, Timeline } from "../../timeline";
import { inviteHost } from "../actions";
import { StageSelect } from "../stage-select";

export const metadata: Metadata = { title: "Pilot request" };

/** One pilot request: who asked, where it stands, and the conversation so far. */
export default async function PilotRequestPage({ params }: PageProps<"/admin/pipeline/[requestId]">) {
  await requirePlatformAdmin();
  const { requestId } = await params;
  const admin = createAdminClient();
  const { data: r } = await admin.from("pilot_requests").select("*").eq("id", requestId).maybeSingle();
  if (!r) missing();

  const email = String(r.email).toLowerCase();
  const [{ data: invite }, { data: noteData }, { data: emailData }, { data: person }, { data: account }] = await Promise.all([
    admin.from("host_invitations").select("invited_at, used_at, expires_at").eq("email", email).maybeSingle(),
    admin.from("admin_notes").select(NOTE_COLUMNS).eq("pilot_request_id", requestId).order("created_at", { ascending: false }),
    admin.from("email_log").select("*").eq("to_email", email).order("created_at", { ascending: false }).limit(50),
    admin.from("profiles").select("id, full_name").eq("email", email).maybeSingle(),
    r.organization_id ? admin.from("organizations").select("id, name").eq("id", r.organization_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const today = utcToZonedDate(new Date().toISOString(), ADMIN_TZ);
  const inv = invite as { invited_at: string; used_at: string | null; expires_at: string } | null;
  const inviteText = !inv
    ? "Not invited yet"
    : inv.used_at
      ? `Used ${formatDate(utcToZonedDate(inv.used_at, ADMIN_TZ), { weekday: undefined })}`
      : new Date(inv.expires_at) < new Date()
        ? `Expired ${formatDate(utcToZonedDate(inv.expires_at, ADMIN_TZ), { weekday: undefined })}`
        : `Sent ${formatDate(utcToZonedDate(inv.invited_at, ADMIN_TZ), { weekday: undefined })}, open until ${formatDate(utcToZonedDate(inv.expires_at, ADMIN_TZ), { weekday: undefined, year: undefined })}`;

  const items: TimelineItem[] = [
    { at: r.created_at, kind: "pipeline", title: `${r.name} asked to join the pilot` },
    ...(inv ? [{ at: inv.invited_at, kind: "pipeline" as const, title: "Host invitation sent" }] : []),
    ...(inv?.used_at ? [{ at: inv.used_at, kind: "account" as const, title: "Set up their organization", href: account ? `/admin/accounts/${account.id}` : undefined }] : []),
    ...noteItems((noteData ?? []) as unknown as NoteRow[]),
    ...emailItems((emailData ?? []) as EmailRow[]),
  ];
  items.sort(byNewest);

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/admin/pipeline" className="text-muted hover:text-foreground">
          ← Pipeline
        </Link>
      </p>
      <PageHeader
        title={r.organization}
        sub={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Tag tone={r.status === "declined" ? "neutral" : "brand"}>{stageLabel(r.status)}</Tag>
            <span>
              {r.name} ·{" "}
              <a href={`mailto:${r.email}`} className="text-brand underline underline-offset-4">
                {r.email}
              </a>
              {r.phone ? ` · ${formatPhone(r.phone)}` : ""}
            </span>
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Panel title="Request">
            <Facts
              items={[
                ["Contest", r.contest_name || "—"],
                ["When", r.contest_when || "—"],
                ["Bands", r.bands ?? "—"],
                ["Volunteers", r.volunteers ?? "—"],
                ["Sent", formatDate(utcToZonedDate(r.created_at, ADMIN_TZ), { weekday: undefined })],
              ]}
            />
            {r.notes && <p className="mt-3 rounded-sm bg-background px-3 py-2 text-sm whitespace-pre-line">{r.notes}</p>}
          </Panel>
          <Panel title="Timeline" flush>
            <div className="border-b border-border p-3">
              <NoteComposer action={addNote.bind(null, { pilotRequestId: r.id })} />
            </div>
            <Timeline items={items} today={today} />
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Stage">
            <StageSelect stages={STAGES} value={r.status} move={moveStage.bind(null, r.id)} />
          </Panel>
          <Panel title="Host invitation">
            <p className="text-sm">{inviteText}</p>
            {!inv?.used_at && (
              <ActionForm action={inviteHost.bind(null, r.id)} resetOnSuccess={false} className="mt-2 space-y-2">
                <input type="hidden" name="email" value={r.email} />
                <input type="hidden" name="name" value={r.name} />
                <SubmitButton variant={inv ? "secondary" : "primary"} className="h-8 min-h-8! w-full rounded-sm px-3" pendingText="Inviting…">
                  {inv ? "Send the invitation again" : "Approve as host"}
                </SubmitButton>
              </ActionForm>
            )}
          </Panel>
          <Panel title="Linked">
            <Facts
              items={[
                ["Account", account ? <RecordLink href={`/admin/accounts/${account.id}`}>{account.name}</RecordLink> : "Not set up yet"],
                ["Person", person ? <RecordLink href={`/admin/people/${person.id}`}>{person.full_name || r.email}</RecordLink> : "No account yet"],
              ]}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
