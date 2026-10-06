import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { brand } from "@/lib/brand";
import { requestPilot } from "./pilot-actions";
import { PilotForm } from "./pilot-form";

const roles = [
  {
    title: "Contest hosts",
    body: "One command center for every event: schedule, team, bands and announcements. On contest day, see at a glance whether you're on schedule.",
  },
  {
    title: "Volunteer Leads",
    body: "Build shifts in minutes. Signups fill themselves, capacity is enforced, and you can run contest day alongside the host.",
  },
  {
    title: "Section Leads",
    body: "See who's coming to your station and check bands in with one tap. Contact details unlock on event day, and only then.",
  },
  {
    title: "Volunteers",
    body: "Sign up with just a name, email and phone. Get one agenda for every shift you picked.",
  },
  {
    title: "Band directors",
    body: "Register once: personnel, vehicles and conflicts. On contest day, see your next step, your equipment spot and your times.",
  },
  {
    title: "Families & fans",
    body: "A live performance order: who's on the field now and who's next. On any phone, with no app and no login.",
  },
];

const steps = [
  { n: "1", title: "Set up the event", body: "Dates, venue, check-in stations and volunteer shifts." },
  { n: "2", title: "Share two links", body: "One for volunteers, one for visiting bands." },
  { n: "3", title: "Publish the order", body: "Post performance times when you're ready." },
  { n: "4", title: "Run the day", body: "Check bands through parking, warm-up and the gate, and push the schedule back if you need to." },
];

const pilot = [
  {
    title: "What you get",
    items: [
      "Everything, free for the 2026–27 school year",
      "Unlimited events, volunteers and bands",
      "Help setting up your first event",
      "Direct support from the people building it",
    ],
  },
  {
    title: "What we ask",
    items: [
      "Run at least one real contest with it",
      "A short call before and after your event",
      "Tell us what's clunky, so we can fix it",
    ],
  },
  {
    title: "After the pilot",
    items: [
      "Nothing renews or charges automatically",
      "We'll talk with you about what comes next before the year ends",
      "Volunteers, bands and families never pay",
    ],
  },
];

const JOIN = "#join";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <HeaderBar maxWidth="max-w-6xl">
        <a href="#how" className={`hidden sm:block ${headerLinkClass}`}>
          How it works
        </a>
        <a href="#pilot" className={`hidden sm:block ${headerLinkClass}`}>
          Pilot
        </a>
        <Link href="/login" className={headerLinkClass}>
          Sign in
        </Link>
        <a
          href={JOIN}
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md bg-accent px-4 font-semibold text-[#14213d] hover:opacity-90"
        >
          Join the pilot
        </a>
      </HeaderBar>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-foreground">
            Now inviting host programs to the 2026–27 pilot
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Contest day, without the clipboards.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Replace the spreadsheets, signup forms, group texts and walkie-talkie chatter with one
            place for volunteers, visiting bands and spectators, and keep everyone&apos;s personal
            information private while you do it.
          </p>
          <p className="mt-4 max-w-2xl text-muted">
            Built for marching band contests and other school competitions. Free for pilot hosts all school
            year; spots are limited.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={JOIN} className="rounded-md bg-brand px-5 py-3 font-medium text-brand-foreground hover:opacity-90">
              Join the pilot
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

        <section id="pilot" className="scroll-mt-20 border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium">Limited spots</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Join the 2026–27 pilot</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              We&apos;re working closely with a small group of contest hosts this school year. It&apos;s free, and
              we keep the group small so we can support every host on contest day.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pilot.map((col) => (
                <div key={col.title} className="rounded-xl border border-border bg-background p-6">
                  <h3 className="font-semibold">{col.title}</h3>
                  <ul className="mt-3 space-y-2 leading-7 text-muted">
                    {col.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden className="text-success">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div id="join" className="mt-12 max-w-3xl scroll-mt-20">
              <h3 className="text-xl font-semibold">Request a pilot spot</h3>
              <p className="mt-1 text-muted">Takes a minute. We&apos;ll reply within a few days.</p>
              <div className="mt-6">
                <PilotForm action={requestPilot} />
              </div>
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
