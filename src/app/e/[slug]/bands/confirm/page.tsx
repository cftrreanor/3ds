import type { Metadata } from "next";
import Link from "next/link";
import { EventHeaderBar } from "@/components/event-brand";
import { Card } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/server";
import { ConfirmCode } from "../confirm-code";
import { ConfirmButton } from "./confirm-button";

export const metadata: Metadata = { title: "Confirm registration" };

/**
 * Where the code email's "Confirm registration" button lands, on any device.
 * A button to tap rather than confirming on arrival, so email link checkers
 * can't use it up.
 */
export default async function ConfirmRegistrationPage({ params, searchParams }: PageProps<"/e/[slug]/bands/confirm">) {
  const { slug } = await params;
  const { r, t } = await searchParams;
  const id = typeof r === "string" && /^[0-9a-f-]{36}$/.test(r) ? r : null;
  const { data } = id
    ? await createAdminClient().from("pending_band_registrations").select("id, email, details").eq("id", id).maybeSingle()
    : { data: null };
  const pending = data as { id: string; email: string; details: { band_name: string; school_name: string } } | null;

  return (
    <>
      <EventHeaderBar slug={slug} maxWidth="max-w-md" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        {!pending ? (
          <Card>
            <h1 className="text-2xl font-medium">Nothing to confirm</h1>
            <p className="mt-2 text-muted">
              This registration was already confirmed, or it expired after 7 days. If you already confirmed, you&apos;re
              registered. Otherwise, please fill in the form again.
            </p>
            <Link href={`/e/${slug}/bands`} className="mt-4 inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline">
              Go to registration
            </Link>
          </Card>
        ) : typeof t === "string" && t ? (
          <ConfirmButton
            pendingId={pending.id}
            tokenHash={t}
            bandName={pending.details.band_name}
            schoolName={pending.details.school_name}
            fallback={<ConfirmCode pendingId={pending.id} email={pending.email} bandName={pending.details.band_name} />}
          />
        ) : (
          <ConfirmCode pendingId={pending.id} email={pending.email} bandName={pending.details.band_name} />
        )}
      </main>
    </>
  );
}
