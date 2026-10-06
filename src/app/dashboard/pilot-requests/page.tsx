import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { setPilotStatus } from "./actions";

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
  await requireUser();
  const supabase = await createClient();
  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin");
  if (error) missing();
  if (!isAdmin) notFound();
  const { data } = await supabase.from("pilot_requests").select("*").order("created_at", { ascending: false });
  const requests = (data ?? []) as Request[];
  const counts = Object.fromEntries(Object.keys(LABEL).map((k) => [k, requests.filter((r) => r.status === k).length]));

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pilot requests</h1>
      <p className="mt-1 text-muted">
        {requests.length === 0
          ? "No requests yet. They'll show up here, and you'll get an email for each one."
          : (Object.keys(LABEL) as (keyof typeof LABEL)[])
              .filter((k) => counts[k])
              .map((k) => `${counts[k]} ${LABEL[k].toLowerCase()}`)
              .join(" · ")}
      </p>
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
                <Badge tone={r.status === "new" ? "accent" : "neutral"}>{LABEL[r.status]}</Badge>
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
