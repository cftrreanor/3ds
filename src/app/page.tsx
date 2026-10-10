import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { brand } from "@/lib/brand";
import { requestPilot } from "./pilot-actions";
import { PilotForm } from "./pilot-form";

// The three kinds of event (src/lib/event-types.ts), as the page's main pitch.
const kinds = [
  {
    icon: "🎺",
    title: "Band contests",
    examples: "Marching invitationals, jazz festivals, solo & ensemble",
    points: [
      "Band registration with saved details, one-tap for returning directors",
      "Performance schedule, finals and a live order for families",
      "Check bands through parking, warm-up and the gate",
    ],
  },
  {
    icon: "🙋",
    title: "Volunteer events",
    examples: "Concessions, carnivals, fundraisers, field day",
    points: [
      "Shifts and stations that fill themselves",
      "A check-in desk on any phone, with walk-ups and no-shows",
      "Leads who know exactly who's coming to their station",
    ],
  },
  {
    icon: "🏫",
    title: "School visitor events",
    examples: "Family lunches, open houses, performances, award days",
    points: [
      "Parents register ahead with each child, teacher and grade",
      "Reminders to bring a photo ID, and a calendar invite",
      "Every adult checked in at the door, one by one",
    ],
  },
];

const features = [
  { title: "Sign-ups that run themselves", body: "Share one link or QR code. Capacity is enforced, confirmations and calendar invites go out on their own." },
  { title: "Check-in on any phone", body: "Your team checks people in at the door or the desk with one tap. No app, no laptop, no printed lists." },
  { title: "Your whole team, with the right access", body: "Hosts, Volunteer Leads and Section Leads each see what they need, and nothing they don't." },
  { title: "Numbers at a glance", body: "Who's registered, who's arrived and who's still to come, broken down the way you need it." },
  { title: "Announcements, maps & documents", body: "Post updates and share parking maps or packets with exactly the people who need them." },
  { title: "Registration on your schedule", body: "Open and close it by hand, or set a date and time for it to close on its own." },
];

const steps = [
  { n: "1", title: "Pick the kind of event", body: "Band contest, volunteer event or school visitor event." },
  { n: "2", title: "Set it up", body: "Dates, venue, stations and shifts, or registration questions." },
  { n: "3", title: "Share a link or QR code", body: "Volunteers, bands and parents sign up on their own phones." },
  { n: "4", title: "Run the day", body: "Check everyone in, see who's here, and post updates as things change." },
];

const pilot = [
  {
    title: "What you get",
    items: [
      "Everything, free for the 2026–27 school year",
      "Unlimited events of every kind, volunteers and registrations",
      "Help setting up your first event",
      "Direct support from the people building it",
    ],
  },
  {
    title: "What we ask",
    items: [
      "Run at least one real event with it",
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
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-violet px-5 text-sm font-semibold text-[#1b1938] transition hover:opacity-90"
        >
          Join the pilot
        </a>
      </HeaderBar>

      <main className="flex-1">
        <section className="hero-sky text-white">
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/20">
              Now inviting schools and booster clubs to the 2026–27 pilot
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-[0.96] sm:text-6xl">School events, without the clipboards.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-on-dark-mute">
              Band contests, volunteer events and school visitor days, all in one place. Replace the
              spreadsheets, signup forms, group texts and paper sign-in sheets with simple links your
              volunteers, visiting bands and parents use on their own phones, and keep everyone&apos;s
              personal information private while you do it.
            </p>
            <p className="mt-4 max-w-2xl text-on-dark-mute">
              One tool for the whole school year, for band programs, booster clubs, PTAs and front offices.
              Free for pilot schools all year; spots are limited.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={JOIN} className="rounded-full bg-violet px-6 py-3 font-semibold text-[#1b1938] hover:opacity-90">
                Join the pilot
              </a>
              <a href="#how" className="rounded-md px-5 py-3 font-medium text-white ring-1 ring-white/30 hover:bg-white/10">
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">One platform for every kind of school event</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Choose what kind of event you&apos;re running and {brand.name} gives you exactly the tools it needs.
            </p>
            <ul className="mt-10 grid gap-6 lg:grid-cols-3">
              {kinds.map((k) => (
                <li key={k.title} className="flex flex-col rounded-lg border border-border bg-background p-8">
                  <span aria-hidden className="text-3xl">
                    {k.icon}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold">{k.title}</h3>
                  <p className="mt-1 text-sm text-muted">{k.examples}</p>
                  <ul className="mt-4 space-y-2 leading-7">
                    {k.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span aria-hidden className="text-success">
                          ✓
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Everything event day needs</h2>
          <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title}>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 leading-7 text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">How it works</h2>
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
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-lg bg-brand p-8 text-brand-foreground sm:p-12">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Privacy by default</h2>
            <ul className="mt-4 max-w-3xl space-y-3 leading-7 opacity-90">
              <li>
                Section Leads see who&apos;s assigned to them right away, but phone numbers and emails unlock only on
                event day and lock again at midnight.
              </li>
              <li>
                Band contests never collect student names, just headcounts. For school visitor events, children&apos;s
                names are seen only by your event team and are permanently deleted 30 days after the event.
              </li>
              <li>Families and spectators never need an account or an app.</li>
            </ul>
          </div>
        </section>

        <section id="pilot" className="scroll-mt-20 border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium">Limited spots</p>
            <h2 className="mt-4 text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Join the 2026–27 pilot</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              We&apos;re working closely with a small group of schools and booster clubs this school year. It&apos;s
              free, and we keep the group small so we can support every host on event day.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pilot.map((col) => (
                <div key={col.title} className="rounded-lg border border-border bg-background p-6">
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
        {/* Every page closes on the deep-teal band. */}
        <section className="bg-teal-deep text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight sm:text-4xl">
              Your next event, without the clipboards.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-on-dark-mute">Free for pilot schools all year. Spots are limited.</p>
            <a href={JOIN} className="mt-8 inline-flex rounded-md bg-white px-6 py-3 font-semibold text-teal-deep hover:opacity-90">
              Request a pilot spot
            </a>
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
