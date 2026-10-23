import { cookies } from "next/headers";
import Link from "next/link";
import { switchReviewer } from "@/app/qa/actions";
import { QaControl, type QaEvent } from "@/components/qa-control";
import { personasFor } from "@/lib/demo";
import { QA_COOKIE, isQa, reviewerEmail, reviewerFromCookie } from "@/lib/qa";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Across the top of every QA page: it's test data, who's reviewing, and the
 * outbox; and the QA tools button in the corner. Nothing elsewhere.
 */
export async function QaBar() {
  if (!isQa()) return null;
  const reviewer = reviewerFromCookie((await cookies()).get(QA_COOKIE)?.value);
  if (!reviewer) return null;
  const events = await reviewerEvents(reviewer);
  return (
    <>
      <QaControl events={events} />
      <div className="bg-violet text-header print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
          <p className="font-semibold">
            QA site: test data, and emails go to the Outbox
          </p>
          <p className="sm:ml-auto">Reviewing as {reviewer}</p>
          <Link
            href="/qa/outbox"
            className="font-semibold underline underline-offset-2"
          >
            Outbox
          </Link>
          <form action={switchReviewer}>
            <button
              type="submit"
              className="font-semibold underline underline-offset-2"
            >
              Switch reviewer
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

/** The events in the reviewer's own QA organization, newest first. */
async function reviewerEvents(reviewer: string): Promise<QaEvent[]> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", reviewerEmail(reviewer))
    .maybeSingle();
  if (!profile) return [];
  const { data: orgs } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", profile.id);
  if (!orgs?.length) return [];
  const { data: events } = await admin
    .from("events")
    .select("id, name, slug, event_type, status")
    .in(
      "organization_id",
      orgs.map((o) => o.organization_id),
    )
    .order("created_at", { ascending: false })
    .limit(20);
  return (events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    type: e.event_type as QaEvent["type"],
    published: e.status === "published",
    personas: personasFor(e.event_type).map((p) => ({
      value: p.value,
      label: p.label,
    })),
  }));
}
