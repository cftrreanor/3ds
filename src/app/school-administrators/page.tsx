import type { Metadata } from "next";
import Link from "next/link";
import { requestPilot } from "@/app/pilot-actions";
import { PilotForm } from "@/app/pilot-form";
import { infoBox } from "@/components/audience-page";
import { FaqList } from "@/components/faq-list";
import { HowItWorks, type HowStep } from "@/components/how-it-works";
import { JumpLink } from "@/components/jump-link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ADMINISTRATORS_PAGE, AUDIENCES, CONFERENCES_PAGE } from "@/lib/audiences";
import { brand } from "@/lib/brand";

// For principals and district staff. Brand voice: reassuring and concrete,
// about reliability, support, and less strain on staff; "facilitator" when
// naming the role (docs/brand-voice.md). Every claim must match the product.

const CTA = "Join the pilot";

export const metadata: Metadata = {
  title: "School Event Software for Principals and District Administrators",
  description:
    "One place for every school event: contests, festivals, fairs, volunteer events, visitor days, and parent-teacher conferences. Less strain on staff, clear roles, and families' details deleted on a schedule.",
  alternates: { canonical: ADMINISTRATORS_PAGE.path },
};

const replaces = [
  "A different sign-up tool, form, or spreadsheet for every event",
  "Front office staff answering the same questions by phone and email",
  "Paper sign-in sheets with families' details left in a binder",
  "Clipboards and paper rosters at the door, desk, and gate",
];

const steps: HowStep[] = [
  {
    title: "Your facilitators set up their event",
    body: "Each kind of event has its own setup, one step at a time, so a new facilitator isn't starting from a blank page.",
    screen: "/screens/pick-event-type-blue.webp",
    alt: "Starting a new event: choosing the kind of event, such as a band contest, volunteer event, or school visitor day.",
  },
  {
    title: "Families and volunteers sign up on their own",
    body: "Share one link. Confirmations, calendar invites, and day-before reminders go out without anyone on staff sending them.",
    screen: "/screens/volunteer-signup-blue.webp",
    alt: "A volunteer picking a shift on the event's sign-up page.",
  },
  {
    title: "Event day runs from any phone",
    body: "Your team checks people in at the door or desk on their own phones, with no app to install.",
    screen: "/screens/parent-door-checkin.webp",
    alt: "Door check-in: a family's children and adults, with a Check in button for each adult.",
  },
];

const sections = [
  {
    title: "Every school event in one place",
    body: `The same ${brand.name} account runs every kind of event on your campus, all year, so families see one familiar sign-up page.`,
    points: [
      "Band contests and choir, orchestra, and theater festivals",
      "School fairs, carnivals, and PTO fundraisers",
      "Volunteer events like concessions, field day, and book fairs",
      "Family lunches, open houses, and other visitor days, with door check-in",
      "Parent-teacher conferences, with a free account for each teacher",
    ],
  },
  {
    title: "Less strain on your staff",
    body: "The routine work of an event happens on its own, so your front office and teachers get their time back.",
    points: [
      "Families and volunteers sign up without an account or an app",
      "Confirmations, calendar invites, and reminders are sent for you",
      "Changes reach the people affected by email, like a new performance time",
      "Emergency messages go to the event team, volunteers, and directors by email right away",
    ],
  },
  {
    title: "Clear roles and permissions",
    body: "Facilitators invite the people helping them, and each person sees only what their job needs.",
    points: [
      "Hosts and Co-hosts run the event",
      "Volunteer Leads manage volunteers, and Section Leads run one station",
      "Section Leads see volunteers' phone numbers only on event day",
      "Visiting directors see their own registration, never other schools' contact details",
    ],
  },
];

const privacy = [
  "We ask for only what each event needs: headcounts instead of student names for contests, and no accounts for families or spectators.",
  "Children's details from school visitor events and conferences are deleted 30 days after the event, and volunteers' details 10 days after.",
  "Information families and volunteers give is your school's or organization's. We store it for you, and copies your staff print or download are your records.",
  "No ads, no spam, and emails used only for your event.",
];

const faqs = [
  {
    q: "Does it connect to our student information system?",
    a: `No. There's nothing to install or integrate, and students don't have accounts. Families and volunteers give only what the event needs, right on its sign-up page.`,
  },
  {
    q: "How much training do staff and volunteers need?",
    a: "Very little. Each kind of event walks facilitators through setup one step at a time. Volunteers and families use their phone's web browser with no account, and event-day screens show who's here and what's next.",
  },
  {
    q: "Who owns the information?",
    a: `Your school or organization. ${brand.name} stores it for you and deletes it on a set schedule. Anything your staff print, download, or copy becomes your own record, kept under your policies.`,
  },
  {
    q: "Can our technology or legal team review it first?",
    a: "Yes. Email us, and a person on our team will answer their questions and go through your district's requirements with you.",
  },
  {
    q: "What does it cost?",
    a: "Your pilot is free, with dates we set together. After that, organizing events is a paid plan for the school or organization running them. We'll go over it with you before your pilot ends, and nothing charges automatically. Teachers' parent-teacher conference accounts are free, and volunteers, families, and visiting groups never pay a platform fee.",
  },
];

/** For principals and district administrators: reliability, support, and less staff strain. */
export default function AdministratorsPage() {
  const eventPages = [...AUDIENCES, CONFERENCES_PAGE];
  return (
    <div className="flex flex-1 flex-col">
      <HeaderBar maxWidth="max-w-6xl">
        <Link href="/" className={`hidden sm:block ${headerLinkClass}`}>
          All event types
        </Link>
        <Link href="/login" className={headerLinkClass}>
          Sign in
        </Link>
        <JumpLink
          href="#join"
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-violet px-3 text-[13px] font-semibold text-header transition hover:opacity-90 sm:px-5 sm:text-sm"
        >
          {CTA}
        </JumpLink>
      </HeaderBar>

      <main className="flex-1">
        <section className="hero-sky text-white">
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/20">
              <span aria-hidden>{ADMINISTRATORS_PAGE.icon}</span>
              For principals and district administrators
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-[0.96] sm:text-6xl">Reliable events with less strain on your staff</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-on-dark-mute">
              {brand.name} keeps events organized, so facilitators can focus on their people, not the logistics. And when you need help,
              you&apos;ll reach a real person, not a bot.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <JumpLink href="#join" className="rounded-full bg-violet px-6 py-3 font-semibold text-header hover:opacity-90">
                {CTA}
              </JumpLink>
              <a href={`mailto:${brand.supportEmail}`} className="rounded-md px-5 py-3 font-medium text-white ring-1 ring-white/30 hover:bg-white/10">
                Talk with us
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-xl font-semibold">What it replaces</h2>
            <ul className="mt-5 grid list-disc gap-x-10 gap-y-3 pl-5 leading-7 text-muted marker:text-muted sm:grid-cols-2">
              {replaces.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </section>

        <HowItWorks steps={steps} className="" />

        <div className="mx-auto max-w-6xl divide-y divide-border px-4 sm:px-6">
          {sections.map((s) => (
            <section key={s.title} className="grid gap-4 py-12 md:grid-cols-[2fr_3fr] md:gap-10">
              <h2 className="text-2xl font-medium leading-tight tracking-tight sm:text-3xl">{s.title}</h2>
              <div>
                <p className="leading-7">{s.body}</p>
                <ul className="mt-4 space-y-2 leading-7 text-muted">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="text-success">
                        ✓
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
          <div className={`rounded-lg p-8 sm:p-12 ${infoBox}`}>
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-4xl">Student and family information</h2>
            <ul className="mt-6 grid max-w-5xl gap-4 leading-7 sm:grid-cols-2">
              {privacy.map((p) => (
                <li key={p} className="opacity-90">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">How support works</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Support starts in the product, so most questions never come up. When one does, a real person is behind it.
            </p>
            <dl className="mt-10 grid gap-8 sm:grid-cols-3">
              <div>
                <dt className="font-semibold">Guidance built in</dt>
                <dd className="mt-1 leading-7 text-muted">Setup goes one step at a time, and event-day screens show who&apos;s here and what&apos;s next.</dd>
              </div>
              <div>
                <dt className="font-semibold">Quick answers</dt>
                <dd className="mt-1 leading-7 text-muted">Each kind of event has its own page that answers the questions facilitators ask most.</dd>
              </div>
              <div>
                <dt className="font-semibold">Real people when you need them</dt>
                <dd className="mt-1 leading-7 text-muted">Email us and a person on our team writes back. No bots.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="faq" tabIndex={-1} className="scroll-mt-20 border-t border-border outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Common questions</h2>
            <FaqList faqs={faqs} />
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-xl font-semibold">Every kind of event your campus runs</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {eventPages.map((o) => (
                <li key={o.path}>
                  <Link
                    href={o.path}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 font-medium hover:border-brand"
                  >
                    <span aria-hidden className="text-xl">
                      {o.icon}
                    </span>
                    {o.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="join" tabIndex={-1} className="scroll-mt-20 border-t border-border bg-surface outline-none">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium">Limited spots</p>
            <h2 className="mt-4 text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">{CTA}</h2>
            <p className="mt-3 leading-7 text-muted">
              Your pilot is free, and we set its dates together. Tick the kinds of events your campus runs.{" "}
              <Link href="/#pilot" className="text-brand underline">
                See the pilot details
              </Link>
              .
            </p>
            <div className="mt-8">
              <PilotForm action={requestPilot} />
            </div>
          </div>
        </section>

        <section className="bg-teal-deep text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight sm:text-4xl">Every detail organized. Every organizer supported.</h2>
            <p className="mx-auto mt-4 max-w-xl text-on-dark-mute">Free during your pilot. Spots are limited.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <JumpLink href="#join" className="inline-flex rounded-md bg-white px-6 py-3 font-semibold text-teal-deep hover:opacity-90">
                {CTA}
              </JumpLink>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="inline-flex rounded-md px-6 py-3 font-semibold text-white ring-1 ring-white/40 hover:bg-white/10"
              >
                Talk with us
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
