import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { getOrigin } from "@/lib/data";
import { googleCalendarUrl } from "@/lib/ics";
import { formatPhone } from "@/lib/phone";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";
import { icsDownloadUrl } from "@/lib/volunteer-emails";
import { hasPass, readPass } from "@/lib/volunteer-pass";
import { cancelMyShift } from "./actions";
import { CancelShiftButton, EmailMyLinkForm, ForgetDeviceButton } from "./forms";

export const metadata: Metadata = { title: "My shifts" };

type AgendaRow = {
  assignment_id: string;
  manage_token: string;
  event_id: string;
  event_name: string;
  timezone: string;
  venue_name: string | null;
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
  volunteer_email: string;
};

export default async function MyShiftsPage({ searchParams }: PageProps<"/my">) {
  const { as, link } = await searchParams;
  // "as" is the email someone just signed up with (from the confirmation screen).
  const signedUpAs = typeof as === "string" && as.includes("@") ? as.trim().toLowerCase() : undefined;
  const [user, pass] = await Promise.all([getUser(), readPass()]);

  // Shifts come from two places: this device's pass (no login needed) and,
  // for anyone signed in, their account's email. Duplicates are merged.
  const [fromPass, fromAccount] = await Promise.all([
    hasPass(pass)
      ? createAdminClient().rpc("pass_agenda", { p_volunteer_tokens: pass.v, p_assignment_tokens: pass.a })
      : Promise.resolve({ data: [] }),
    user ? (await createClient()).rpc("my_agenda") : Promise.resolve({ data: [] }),
  ]);
  const byId = new Map<string, AgendaRow>();
  for (const r of [...((fromPass.data ?? []) as AgendaRow[]), ...((fromAccount.data ?? []) as AgendaRow[])]) {
    byId.set(r.assignment_id, r);
  }
  const rows = [...byId.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const { upcoming, past } = splitByTime(rows);
  const byEvent = groupBy(upcoming, (r) => r.event_id);
  const origin = await getOrigin();

  // Events this person volunteers for (or did, before cancelling) that are
  // still taking signups: offer "Sign up for more shifts".
  const knownIds = [...new Set(rows.map((r) => r.event_id))];
  const { data: openEvents } =
    knownIds.length || pass.e.length
      ? await (await createClient())
          .from("events")
          .select("id, slug, name")
          .eq("status", "published")
          .eq("volunteer_signup_open", true)
          .or(
            [
              knownIds.length ? `id.in.(${knownIds.join(",")})` : null,
              pass.e.length ? `slug.in.(${pass.e.join(",")})` : null,
            ]
              .filter(Boolean)
              .join(","),
          )
      : { data: [] };
  const signupLinks = new Map((openEvents ?? []).map((e) => [e.id, { slug: e.slug as string, name: e.name as string }]));
  const eventsWithoutShifts = [...signupLinks.entries()].filter(([id]) => !byEvent.has(id));

  const mismatch =
    user && signedUpAs && signedUpAs !== user.email.toLowerCase() && !rows.some((r) => r.volunteer_email === signedUpAs)
      ? signedUpAs
      : null;
  const emails = [...new Set(rows.map((r) => r.volunteer_email))];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-accent" />
            {brand.name}
          </Link>
          {user ? (
            <form action="/auth/signout" method="post">
              <button className="min-h-11 rounded-md px-3 text-sm text-muted hover:text-foreground">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="min-h-11 content-center rounded-md px-3 text-sm text-muted hover:text-foreground">
              Organizer sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">My shifts</h1>
        {emails.length > 0 && <p className="mt-1 text-sm text-muted">{emails.join(", ")}</p>}

        {link === "invalid" && (
          <Card className="mt-6 bg-accent-soft">
            <p className="text-sm">That link isn&apos;t valid anymore. Enter your email below and we&apos;ll send a fresh one.</p>
          </Card>
        )}

        {mismatch && (
          <Card className="mt-6 bg-accent-soft">
            <p className="font-medium">You signed up as {mismatch}</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              This device is signed in as {user!.email}. Open the confirmation email we sent to {mismatch} and tap
              “View or cancel my shifts”, or switch accounts.
            </p>
            <SwitchAccountButton email={mismatch} label={`Sign in as ${mismatch}`} />
          </Card>
        )}

        {eventsWithoutShifts.map(([id, ev]) => (
          <Card key={id} className="mt-8">
            <p className="font-medium">{ev.name}</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {byEvent.size === 0 && rows.length === 0
                ? "You don't have any shifts right now. Volunteer signup is still open."
                : "Volunteer signup is still open for this event."}
            </p>
            <SignUpMoreLink slug={ev.slug} primary />
          </Card>
        ))}

        {upcoming.length === 0 && eventsWithoutShifts.length === 0 && (
          <Card className="mt-8">
            <p className="font-medium">
              {rows.length || user || hasPass(pass) ? "No upcoming shifts here" : "Find your shifts"}
            </p>
            <p className="mt-1 mb-4 text-sm leading-6 text-muted">
              Enter the email you signed up with and we&apos;ll send you a private link. Tap it on this device and
              we&apos;ll remember you here. No password needed.
            </p>
            <EmailMyLinkForm email={signedUpAs} />
          </Card>
        )}

        {[...byEvent.entries()].map(([eventId, items]) => {
          const tz = items[0].timezone;
          const days = groupBy(items, (r) => utcToZonedDate(r.starts_at, tz));
          return (
            <section key={eventId} className="mt-8">
              <h2 className="text-lg font-semibold">{items[0].event_name}</h2>
              <p className="text-sm text-muted">
                {[items[0].venue_name, items[0].venue_address].filter(Boolean).join(" · ")}
              </p>
              {[...days.entries()].map(([day, shifts]) => (
                <div key={day} className="mt-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{formatDate(day)}</h3>
                  <ul className="mt-2 space-y-3">
                    {shifts.map((r) => (
                      <li key={r.assignment_id}>
                        <ShiftCard row={r} origin={origin} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {signupLinks.has(eventId) && <SignUpMoreLink slug={signupLinks.get(eventId)!.slug} />}
            </section>
          );
        })}

        {past.length > 0 && (
          <p className="mt-10 text-sm text-muted">
            Plus {past.length} past shift{past.length === 1 ? "" : "s"}. Thank you for helping!
          </p>
        )}

        {hasPass(pass) && rows.length > 0 && (
          <div className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted">
            <span>This device remembers your shifts.</span>
            <ForgetDeviceButton />
          </div>
        )}
      </main>
    </div>
  );
}

function ShiftCard({ row: r, origin }: { row: AgendaRow; origin: string }) {
  const tz = r.timezone;
  const google = googleCalendarUrl({
    timezone: tz,
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
    summary: `Volunteer: ${r.station_name} (${r.event_name})`,
    location: [r.venue_name, r.venue_address].filter(Boolean).join(", "),
    description: [r.station_location && `Report to: ${r.station_location}`, r.instructions].filter(Boolean).join("\n"),
  });
  return (
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
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href={google} target="_blank" rel="noreferrer" className="font-medium text-brand underline-offset-4 hover:underline">
          Add to Google Calendar
        </a>
        <a href={icsDownloadUrl(origin, r.manage_token)} className="font-medium text-brand underline-offset-4 hover:underline">
          Apple / Outlook calendar
        </a>
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-muted">{r.checked_in_at ? "✓ Checked in" : ""}</span>
        {!r.checked_in_at && <CancelShiftButton action={cancelMyShift.bind(null, r.assignment_id)} label={r.station_name} />}
      </div>
    </Card>
  );
}

function SignUpMoreLink({ slug, primary = false }: { slug: string; primary?: boolean }) {
  return (
    <Link
      href={`/e/${slug}/volunteer`}
      className={`mt-4 inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium ${
        primary ? "bg-brand text-brand-foreground hover:opacity-90" : "border border-brand text-brand hover:bg-accent-soft"
      }`}
    >
      Sign up for more shifts
    </Link>
  );
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

/** Shifts that haven't ended yet vs. ones that have. */
function splitByTime(rows: AgendaRow[]) {
  const now = Date.now();
  const ended = (r: AgendaRow) => new Date(r.ends_at).getTime() < now;
  return { upcoming: rows.filter((r) => !ended(r)), past: rows.filter(ended) };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}
