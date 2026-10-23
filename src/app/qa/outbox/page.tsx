import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { HeaderBar } from "@/components/logo";
import { Card } from "@/components/ui";
import { isQa } from "@/lib/qa";
import { isSchemaError, missing } from "@/lib/schema-check";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "QA outbox" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

/** Every email the QA site would have sent, newest first (src/lib/email.ts). */
export default async function QaOutboxPage() {
  await connection(); // Read fresh on every visit, never at build time.
  if (!isQa()) redirect("/");
  const { data: emails, error } = await createAdminClient()
    .from("qa_outbox")
    .select("id, created_at, recipients, subject, invite")
    .order("created_at", { ascending: false })
    .limit(200);
  if (isSchemaError(error)) missing();

  return (
    <>
      <HeaderBar maxWidth="max-w-4xl" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-12">
        <h1 className="text-4xl font-medium tracking-tight">Outbox</h1>
        <p className="mt-2 text-muted">
          Emails the QA site would have sent, newest first. Nothing here reaches anyone. Times are Central Time.
        </p>
        {!emails?.length ? (
          <Card className="mt-8">
            <p className="font-medium">No emails yet</p>
            <p className="mt-1 text-sm text-muted">Book a time, sign up as a volunteer, or invite someone, and the email shows up here.</p>
          </Card>
        ) : (
          <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
            {emails.map((e) => (
              <li key={e.id}>
                <Link href={`/qa/outbox/${e.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-brand-soft sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="font-semibold sm:flex-1">
                    {e.subject}
                    {e.invite && <span className="ml-2 text-sm font-normal text-muted">{e.invite === "CANCEL" ? "Calendar cancel" : "Calendar invite"}</span>}
                  </span>
                  <span className="text-sm text-muted sm:w-64 sm:truncate">{e.recipients.join(", ")}</span>
                  <span className="text-sm text-muted tabular-nums sm:w-32 sm:text-right">{when(e.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
