import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";
import { cancelMyShift } from "./actions";
import { CancelShiftButton } from "./cancel-button";

export const metadata: Metadata = { title: "My shifts" };

type AgendaRow = {
  assignment_id: string;
  event_id: string;
  event_name: string;
  venue_address: string;
  station_name: string;
  station_location: string | null;
  instructions: string | null;
  shift_title: string;
  shift_description: string | null;
  starts_at: string;
  ends_at: string;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  checked_in_at: string | null;
};

export default async function MyShiftsPage({ searchParams }: PageProps<"/my">) {
  const { as } = await searchParams;
  // "as" is the email someone just signed up with (from the confirmation screen or email).
  const signedUpAs = typeof as === "string" && as.includes("@") ? as.trim().toLowerCase() : null;
  const user = await getUser();
  if (!user) redirect(`/login?next=/my${signedUpAs ? `&email=${encodeURIComponent(signedUpAs)}` : ""}`);
  const mismatch = signedUpAs && signedUpAs !== user.email.toLowerCase() ? signedUpAs : null;

  const supabase = await createClient();
  const [{ data }, { data: tzRows }] = await Promise.all([
    supabase.rpc("my_agenda"),
    supabase.from("volunteers").select("events(id, timezone)"),
  ]);
  const rows = (data ?? []) as AgendaRow[];
  const tzByEvent = new Map<string, string>();
  for (const r of (tzRows ?? []) as unknown as { events: { id: string; timezone: string } | null }[]) {
    if (r.events) tzByEvent.set(r.events.id, r.events.timezone);
  }

  const { upcoming, past } = splitByTime(rows);
  const byEvent = groupBy(upcoming, (r) => r.event_id);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-accent" />
            {brand.name}
          </Link>
          <form action="/auth/signout" method="post">
            <button className="min-h-11 rounded-md px-3 text-sm text-muted hover:text-foreground">Sign out</button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">My shifts</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>

        {mismatch && (
          <Card className="mt-6 bg-accent-soft">
            <p className="font-medium">You signed up as {mismatch}</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              This device is signed in as {user.email}, so it&apos;s showing that account&apos;s shifts. Switch
              accounts to see the shifts for {mismatch}.
            </p>
            <SwitchAccountButton email={mismatch} label={`Sign in as ${mismatch}`} />
          </Card>
        )}

        {upcoming.length === 0 && !mismatch && (
          <Card className="mt-8">
            <p className="font-medium">No upcoming shifts for {user.email}</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Shifts show up here for the email address you used when you signed up. Used a different one?
            </p>
            <SwitchAccountButton label="Sign in with a different email" />
          </Card>
        )}

        {[...byEvent.entries()].map(([eventId, items]) => {
          const tz = tzByEvent.get(eventId) ?? "America/Chicago";
          const days = groupBy(items, (r) => utcToZonedDate(r.starts_at, tz));
          return (
            <section key={eventId} className="mt-8">
              <h2 className="text-lg font-semibold">{items[0].event_name}</h2>
              <p className="text-sm text-muted">{items[0].venue_address}</p>
              {[...days.entries()].map(([day, shifts]) => (
                <div key={day} className="mt-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{formatDate(day)}</h3>
                  <ul className="mt-2 space-y-3">
                    {shifts.map((r) => (
                      <li key={r.assignment_id}>
                        <Card className="p-4 sm:p-5">
                          <p className="text-lg font-semibold">{formatTimeRange(r.starts_at, r.ends_at, tz)}</p>
                          <p className="mt-0.5 font-medium">
                            {r.station_name} · {r.shift_title}
                          </p>
                          {r.station_location && (
                            <p className="mt-2 text-sm">
                              <span className="font-medium">Report to:</span> {r.station_location}
                            </p>
                          )}
                          {(r.instructions || r.shift_description) && (
                            <p className="mt-2 text-sm leading-6 text-muted">
                              {[r.shift_description, r.instructions].filter(Boolean).join(" ")}
                            </p>
                          )}
                          {r.lead_name && (
                            <div className="mt-3 rounded-lg bg-background px-3 py-2 text-sm">
                              <p>
                                <span className="font-medium">Your lead:</span> {r.lead_name}
                              </p>
                              <p className="mt-0.5 flex flex-wrap gap-x-4">
                                {r.lead_phone && (
                                  <a href={`tel:${r.lead_phone}`} className="font-medium text-brand underline-offset-4 hover:underline">
                                    Call {formatPhone(r.lead_phone)}
                                  </a>
                                )}
                                {r.lead_phone && (
                                  <a href={`sms:${r.lead_phone}`} className="font-medium text-brand underline-offset-4 hover:underline">
                                    Text
                                  </a>
                                )}
                                {r.lead_email && (
                                  <a href={`mailto:${r.lead_email}`} className="font-medium text-brand underline-offset-4 hover:underline">
                                    Email
                                  </a>
                                )}
                              </p>
                            </div>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-sm text-muted">{r.checked_in_at ? "✓ Checked in" : ""}</span>
                            {!r.checked_in_at && (
                              <CancelShiftButton action={cancelMyShift.bind(null, r.assignment_id)} label={r.station_name} />
                            )}
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}

        {past.length > 0 && (
          <p className="mt-10 text-sm text-muted">
            Plus {past.length} past shift{past.length === 1 ? "" : "s"}. Thank you for helping!
          </p>
        )}
      </main>
    </div>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}

/** Shifts that haven't ended yet vs. ones that have. */
function splitByTime(rows: AgendaRow[]) {
  const now = Date.now();
  const ended = (r: AgendaRow) => new Date(r.ends_at).getTime() < now;
  return { upcoming: rows.filter((r) => !ended(r)), past: rows.filter(ended) };
}

/** Signs out, then opens sign-in (pre-filled when we know the email) and returns here. */
function SwitchAccountButton({ email, label }: { email?: string; label: string }) {
  const next = `/login?next=/my${email ? `&email=${encodeURIComponent(email)}` : ""}`;
  return (
    <form action="/auth/signout" method="post" className="mt-3">
      <input type="hidden" name="next" value={next} />
      <button className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90">
        {label}
      </button>
    </form>
  );
}
