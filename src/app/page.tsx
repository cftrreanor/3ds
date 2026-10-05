import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { brand } from "@/lib/brand";

const roles = [
  {
    title: "Contest hosts",
    body: "One command center for every event: schedule, staff, bands and announcements.",
  },
  {
    title: "Volunteer directors",
    body: "Build shifts in minutes. Signups fill themselves, capacity is enforced, check-in is one tap.",
  },
  {
    title: "Section leads",
    body: "See who's coming to your station. Contact details unlock on event day, and only then.",
  },
  {
    title: "Volunteers",
    body: "Sign up with just a name, email and phone. Get one agenda for every shift you picked.",
  },
  {
    title: "Band directors",
    body: "Register your ensemble once: personnel, vehicles and conflicts. See your times when they post.",
  },
  {
    title: "Families & fans",
    body: "A live performance order and alerts on any phone. No app, no login.",
  },
];

const steps = [
  { n: "1", title: "Set up the event", body: "Dates, venue, stations and shifts." },
  { n: "2", title: "Share two links", body: "One for volunteers, one for visiting bands." },
  { n: "3", title: "Publish the order", body: "Post performance times when you're ready." },
  { n: "4", title: "Run the day", body: "Check people in and send announcements from your phone." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <HeaderBar maxWidth="max-w-6xl">
        <a href="#how" className={`hidden sm:block ${headerLinkClass}`}>
          How it works
        </a>
        <a href="#pricing" className={`hidden sm:block ${headerLinkClass}`}>
          Pricing
        </a>
        <Link href="/login" className={headerLinkClass}>
          Sign in
        </Link>
        <a
          href={`mailto:${brand.supportEmail}?subject=Pilot%20program`}
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md bg-accent px-4 font-semibold text-[#14213d] hover:opacity-90"
        >
          Join the pilot
        </a>
      </HeaderBar>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-foreground">
            For marching band contests and other school competitions
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Contest day, without the clipboards.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Replace the spreadsheets, signup forms, group texts and walkie-talkie chatter with one
            place for volunteers, visiting bands and spectators, and keep everyone&apos;s personal
            information private while you do it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`mailto:${brand.supportEmail}?subject=Pilot%20program`}
              className="rounded-md bg-brand px-5 py-3 font-medium text-brand-foreground hover:opacity-90"
            >
              Host your contest with us
            </a>
            <a
              href="#how"
              className="rounded-md border border-border bg-surface px-5 py-3 font-medium hover:bg-background"
            >
              See how it works
            </a>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Built for everyone on the field</h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((r) => (
                <li key={r.title} className="rounded-xl border border-border bg-background p-6">
                  <h3 className="font-semibold">{r.title}</h3>
                  <p className="mt-2 leading-7 text-muted">{r.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-semibold text-brand-foreground">
                  {s.n}
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 leading-7 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl bg-brand p-8 text-brand-foreground sm:p-12">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Privacy by default</h2>
            <p className="mt-4 max-w-2xl leading-7 opacity-90">
              Section leads see who&apos;s assigned to them right away, but phone numbers and emails
              unlock only on event day and lock again at midnight. We never collect student names, just
              headcounts.
            </p>
          </div>
        </section>

        <section id="pricing" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Simple pricing</h2>
            <div className="mt-10 max-w-md rounded-2xl border border-border bg-background p-8">
              <p className="font-medium text-muted">Host license</p>
              <p className="mt-2 text-4xl font-semibold">
                $250<span className="text-lg font-normal text-muted"> / year</span>
              </p>
              <ul className="mt-6 space-y-2 leading-7 text-muted">
                <li>Unlimited events during your year</li>
                <li>Unlimited volunteers and band registrations</li>
                <li>Director and section lead seats included</li>
                <li>Free for volunteers, bands and spectators</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <a href={`mailto:${brand.supportEmail}`} className="hover:text-foreground">
            {brand.supportEmail}
          </a>
        </div>
      </footer>
    </div>
  );
}
