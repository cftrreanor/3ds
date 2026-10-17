import type { Metadata } from "next";
import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { infoBox } from "@/components/audience-page";
import { FaqList } from "@/components/faq-list";
import { HowItWorks, type HowStep } from "@/components/how-it-works";
import { SiteFooter } from "@/components/site-footer";
import { CONFERENCES_PAGE } from "@/lib/audiences";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Parent-Teacher Conference Scheduling, Free for Teachers",
  description:
    "Free for teachers: set aside a day and families book their own conference time, in person or on video, with calendar invites, reminders, and a link to change or cancel.",
  alternates: { canonical: CONFERENCES_PAGE.path },
};

/** "Free for teachers": signing in from here lands on the teacher setup page. */
const START = "/login?next=/dashboard/teacher";

const steps: HowStep[] = [
  {
    title: "Set your day and hours",
    body: "Pick the meeting length and a few minutes between meetings. Add breaks if you need them.",
    screen: "/screens/conference-meeting-times.webp",
    alt: "Conference Setup: the day and hours, 15-minute meetings with 5 minutes between them, and breaks.",
  },
  {
    title: "Families pick a time",
    body: "Share one link. Families choose an open time, in person or on video. Taken times aren't shown, so no one is double-booked.",
    screen: "/screens/conference-booking-page.webp",
    alt: "A parent booking a conference: open times to pick from, their child's name, and their own details.",
  },
  {
    title: "Everyone gets the details",
    body: "Each parent gets a calendar invite and a reminder, and can change or cancel from their own link.",
    screen: "/screens/conference-family-booking.webp",
    alt: "A family's booking page: when and where they meet the teacher, who's coming, and a way to change the time.",
  },
];

const points = [
  "Each parent or guardian gets a confirmation and a calendar invite",
  "A reminder the day before",
  "Families change or cancel from their own link, and the time opens up for someone else",
  "Up to four parents or guardians on one booking",
];

const privacy = [
  "Only you see children's names and family notes, not anyone else at the school or any other family.",
  "Families never see who else booked. Taken times simply aren't listed.",
  "Bookings are deleted 30 days after your conferences.",
];

// Plain answers to what teachers ask before signing up.
const faqs = [
  {
    q: "Is it really free for teachers?",
    a: "Yes. A teacher account is free and runs parent-teacher conferences, one published at a time while we're in the pilot. You sign in with your email, and there's no credit card.",
  },
  {
    q: "Can families meet on video?",
    a: "Yes. Families choose in person or on video when they book. When you set up, you add your room, a video link, or both.",
  },
  {
    q: "Do families need to make an account?",
    a: "No. Families book from your link without an account. Each booking gets its own link to change or cancel.",
  },
  {
    q: "Can more than one parent come?",
    a: "Yes. Up to four parents or guardians can be on one booking, and each one gets the confirmation and calendar invite.",
  },
];

/** Parent-teacher conferences: what they do, and a free teacher account to run them. */
export default function ConferencesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <HeaderBar maxWidth="max-w-6xl">
        <Link href="/" className={`hidden sm:block ${headerLinkClass}`}>
          All event types
        </Link>
        <Link href="/login" className={headerLinkClass}>
          Sign in
        </Link>
        <Link
          href={START}
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-violet px-3 text-[13px] font-semibold text-header transition hover:opacity-90 sm:px-5 sm:text-sm"
        >
          Free for teachers
        </Link>
      </HeaderBar>

      <main className="flex-1">
        <section className="hero-sky text-white">
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/20">
              <span aria-hidden>{CONFERENCES_PAGE.icon}</span>
              Parent-teacher conferences
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-[0.96] sm:text-6xl">
              Parent-teacher conferences that schedule themselves
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-on-dark-mute">
              Set aside a day, share one link, and families book their own time, in person or on video. No sign-up
              sheets, no reply-all emails, and no double bookings.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={START} className="rounded-full bg-violet px-6 py-3 font-semibold text-header hover:opacity-90">
                Free for teachers
              </Link>
            </div>
            <p className="mt-4 text-sm text-on-dark-mute">Sign in with your email. No credit card.</p>
          </div>
        </section>

        <HowItWorks steps={steps} className="" />

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-[2fr_3fr] md:gap-10">
          <h2 className="text-2xl font-medium leading-tight tracking-tight sm:text-3xl">Families are taken care of</h2>
          <ul className="space-y-2 leading-7">
            {points.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="text-success">
                  ✓
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className={`rounded-lg p-8 sm:p-12 ${infoBox}`}>
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-4xl">Who sees what</h2>
            <ul className="mt-6 grid max-w-5xl gap-4 leading-7 sm:grid-cols-2">
              {privacy.map((p) => (
                <li key={p} className="opacity-90">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Common questions</h2>
            <FaqList faqs={faqs} />
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold">What&apos;s free</h2>
            <p className="mt-3 leading-7 text-muted">
              A free teacher account runs parent-teacher conferences, one published at a time while we&apos;re in the pilot. Planning a band contest,
              school fair, volunteer event, or family visitor day?{" "}
              <Link href="/#join" className="font-medium text-brand underline">
                Join the pilot
              </Link>{" "}
              and we&apos;ll set up {brand.name} for your school.
            </p>
          </div>
        </section>

        <section className="bg-teal-deep text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight sm:text-4xl">Every detail organized. Every organizer supported.</h2>
            <Link href={START} className="mt-8 inline-flex rounded-md bg-white px-6 py-3 font-semibold text-teal-deep hover:opacity-90">
              Free for teachers
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
