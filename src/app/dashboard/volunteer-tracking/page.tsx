import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isSchemaError, missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { trackingAccounts } from "@/lib/volunteer-tracking";
import { Card } from "@/components/ui";
import { brand } from "@/lib/brand";
import { loadAccountPlan } from "@/lib/plan";
import { removeFromVolunteerHistory } from "./actions";
import { HistoryTable, type HistoryRow } from "./history-table";

export const metadata: Metadata = { title: "Volunteer tracking" };

/**
 * Every adult who has volunteered at the account's events: shifts signed up,
 * shifts checked in, and the share they showed up for. For hosts and
 * Volunteer Leads (supabase/migrations/20261221000000_volunteer_history.sql).
 */
export default async function VolunteerTrackingPage({ searchParams }: PageProps<"/dashboard/volunteer-tracking">) {
  const { account: picked } = await searchParams;
  const user = await requireUser();
  const accounts = await trackingAccounts(user.id);
  if (!accounts.length) redirect("/dashboard");
  const account = accounts.find((a) => a.id === picked) ?? accounts[0];

  const supabase = await createClient();
  const [{ data, error }, plan] = await Promise.all([
    supabase.rpc("volunteer_report", { p_org: account.id }),
    loadAccountPlan(supabase, account.id),
  ]);
  if (error && isSchemaError(error)) missing();
  // Lower packages keep recording history (and can download it), but the tracking itself needs Volunteer Command or up.
  const notIncluded = plan?.volunteer_history === false || (error?.code === "42501" && error.message.startsWith("Your "));
  if (error && !notIncluded) console.error("volunteer_report failed", error);
  const downloadHref = `/dashboard/volunteer-tracking/download?account=${account.id}`;
  const rows = ((data ?? []) as HistoryRow[]).map((r) => ({ ...r, email: r.email.toLowerCase() }));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Volunteer tracking</h1>
      <p className="mt-2 max-w-3xl leading-7 text-muted">
        Everyone who has volunteered at your account&apos;s events, with the shifts they signed up for and checked in to.
        Use it to put your most dependable volunteers first, like for chaperone spots. Shifts count once they&apos;re over.
      </p>
      {accounts.length > 1 && (
        <nav aria-label="Account" className="mt-4 flex flex-wrap gap-2">
          {accounts.map((a) => (
            <Link
              key={a.id}
              href={{ pathname: "/dashboard/volunteer-tracking", query: { account: a.id } }}
              aria-current={a.id === account.id ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium ${
                a.id === account.id ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface hover:bg-background"
              }`}
            >
              {a.name}
            </Link>
          ))}
        </nav>
      )}
      {notIncluded ? (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Volunteer tracking isn&apos;t included in your {plan?.package_name ?? ""} plan</h2>
          <p className="mt-2 leading-7 text-muted">
            We still record who volunteers at your events and which shifts they check in to. Upgrade to Volunteer Command to rank your
            volunteers by how often they show up and search your history here. To upgrade, write to us at{" "}
            <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand underline underline-offset-4">
              {brand.supportEmail}
            </a>
            .
          </p>
          <p className="mt-2 leading-7 text-muted">You can download your history as a spreadsheet anytime.</p>
          <a
            href={downloadHref}
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-field-border bg-surface px-4 text-sm font-semibold hover:border-brand"
          >
            Download spreadsheet
          </a>
        </Card>
      ) : error ? (
        <p className="mt-6 text-danger">We couldn&apos;t load your volunteer tracking. Please try again.</p>
      ) : (
        <div className="mt-6">
          <HistoryTable
            key={account.id}
            rows={rows}
            remove={account.isHost ? removeFromVolunteerHistory.bind(null, account.id) : undefined}
          />
        </div>
      )}
      <p className="mt-8 max-w-3xl text-sm text-muted">
        🔒 Only your Hosts, Co-hosts, and Volunteer Leads see this. Names, emails, and shift counts are kept for 2 years after
        someone&apos;s last event; phone numbers are deleted 10 days after each event, and under-18 helpers aren&apos;t included.
        {account.isHost ? " If someone asks to be forgotten, use Remove next to their name." : ""}
      </p>
    </div>
  );
}
