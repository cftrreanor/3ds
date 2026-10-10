import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Input, Select } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/admin";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { inviteHost, setPilotStatus } from "./actions";

export const metadata: Metadata = { title: "Pilot requests" };

type Request = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string;
  contest_name: string | null;
  contest_when: string | null;
  bands: number | null;
  volunteers: number | null;
  notes: string | null;
  status: "new" | "contacted" | "accepted" | "declined";
  created_at: string;
};

const LABEL = { new: "New", contacted: "Contacted", accepted: "Accepted", declined: "Declined" } as const;

/** "Join the pilot" requests from the home page. FieldCommand staff only. */
export default async function PilotRequestsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [{ data }, { data: invData }] = await Promise.all([
    supabase.from("pilot_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("host_invitations").select("email, invited_at, used_at, expires_at"),
  ]);
  const requests = (data ?? []) as Request[];
  // Host invitations by email: who's been invited, and who has set up their organization.
  const invites = new Map(
    ((invData ?? []) as { email: string; invited_at: string; used_at: string | null; expires_at: string }[]).map((i) => [
      i.email.toLowerCase(),
      i,
    ]),
  );
  const inviteState = (email: string) => {
    const i = invites.get(email.toLowerCase());
    if (!i) return null;
    if (i.used_at) return `Set up their organization ${formatDate(i.used_at.slice(0, 10))}`;
    if (new Date(i.expires_at) < new Date()) return `Host invitation expired ${formatDate(i.expires_at.slice(0, 10))}`;
    return `Invited to host ${formatDate(i.invited_at.slice(0, 10))}`;
  };
  const counts = Object.fromEntries(Object.keys(LABEL).map((k) => [k, requests.filter((r) => r.status === k).length]));

  return (
    <div>
      <h2 className="text-2xl font-semibold">Pilot requests</h2>
      <p className="mt-1 text-muted">
        {requests.length === 0
          ? "No requests yet. They'll show up here, and you'll get an email for each one."
          : (Object.keys(LABEL) as (keyof typeof LABEL)[])
              .filter((k) => counts[k])
              .map((k) => `${counts[k]} ${LABEL[k].toLowerCase()}`)
              .join(" · ")}
      </p>
      <Card className="mt-6">
        <h3 className="font-semibold">Invite a host</h3>
        <p className="mt-1 text-sm text-muted">
          Hosts are set up by invitation: only invited emails can create an organization. Approve a request below, or invite
          anyone by email.
        </p>
        <ActionForm action={inviteHost.bind(null, null)} className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Email" className="min-w-60 flex-1">
            <Input name="email" type="email" required placeholder="director@school.org" />
          </Field>
          <SubmitButton pendingText="Inviting…">Invite as host</SubmitButton>
        </ActionForm>
      </Card>
      <ul className="mt-6 space-y-4">
        {requests.map((r) => (
          <li key={r.id}>
            <Card className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.organization}</p>
                  <p className="text-sm text-muted">
                    {r.name} ·{" "}
                    <a href={`mailto:${r.email}`} className="text-brand underline-offset-4 hover:underline">
                      {r.email}
                    </a>
                    {r.phone ? ` · ${formatPhone(r.phone)}` : ""}
                  </p>
                </div>
                <Badge tone={r.status === "new" ? "info" : "neutral"}>{LABEL[r.status]}</Badge>
              </div>
              <p className="text-sm">
                {[
                  r.contest_name,
                  r.contest_when,
                  r.bands != null ? `${r.bands} bands` : null,
                  r.volunteers != null ? `${r.volunteers} volunteers` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || <span className="text-muted">No contest details</span>}
              </p>
              {r.notes && <p className="whitespace-pre-line rounded-md bg-background px-3 py-2 text-sm">{r.notes}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-sm">
                  {inviteState(r.email) ?? <span className="text-muted">Not invited to host yet</span>}
                </p>
                <ActionForm action={inviteHost.bind(null, r.id)} resetOnSuccess={false}>
                  <input type="hidden" name="email" value={r.email} />
                  <input type="hidden" name="name" value={r.name} />
                  <SubmitButton variant={invites.has(r.email.toLowerCase()) ? "secondary" : "primary"} className="min-h-9 px-3 text-xs" pendingText="Inviting…">
                    {invites.has(r.email.toLowerCase()) ? "Send the host invitation again" : "Approve as host"}
                  </SubmitButton>
                </ActionForm>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-xs text-muted">Sent {formatDate(r.created_at.slice(0, 10))}</p>
                <ActionForm action={setPilotStatus.bind(null, r.id)} resetOnSuccess={false} className="flex items-center gap-2">
                  <Select name="status" defaultValue={r.status} aria-label="Status" className="min-h-9 w-36 text-sm">
                    {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => (
                      <option key={k} value={k}>
                        {LABEL[k]}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton variant="secondary" className="min-h-9 px-3 text-xs">
                    Save
                  </SubmitButton>
                </ActionForm>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
