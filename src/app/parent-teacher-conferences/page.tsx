import type { Metadata } from "next";
import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { CONFERENCES_PAGE } from "@/lib/audiences";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Parent-Teacher Conference Scheduling, Free for Teachers",
  description:
    "Free for teachers: set aside a day and families book their own conference time, in person or on video, with calendar invites, reminders and a link to change or cancel.",
  alternates: { canonical: CONFERENCES_PAGE.path },
};

/** "Free for teachers": signing in from here lands on the teacher setup page. */
const START = "/login?next=/dashboard/teacher";

const steps = [
  { title: "Set your day and hours", body: "Pick the meeting length and a few minutes between meetings. Add breaks if you need them." },
  { title: "Say where you'll meet", body: "Your classroom, video, or let each family choose. Paste a video link, or add one to each invite yourself." },
  { title: "Share one link", body: "Families pick an open time. Booked times disappear, so no one is ever double-booked." },
];

const points = [
  "Each parent or guardian gets a confirmation and a calendar invite",
  "A reminder the day before",
  "Families change or cancel from their own link, and the time opens up for someone else",
  "Up to four parents or guardians on one booking",
];

const privacy = [
  "Only you see children's names and family notes. No one else at the school, and no other family.",
  "Families never see who else booked. Taken times simply aren't listed.",
  "Bookings are deleted 30 days after your conferences.",
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
              Parent-teacher conferences that schedule themselves.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-on-dark-mute">
              Set aside a day, share one link, and families book their own time, in person or on video. No sign-up
              sheets, no reply-all emails, no double bookings.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={START} className="rounded-full bg-violet px-6 py-3 font-semibold text-header hover:opacity-90">
                Free for teachers
              </Link>
            </div>
            <p className="mt-4 text-sm text-on-dark-mute">Sign in with your email. No password or credit card.</p>
          </div>
        </section>

        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-4xl">Ready in a few minutes</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 leading-7 text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

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
          <div className="rounded-lg bg-brand p-8 text-brand-foreground sm:p-12">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-4xl">Who sees what</h2>
            <ul className="mt-6 grid max-w-5xl gap-4 leading-7 sm:grid-cols-3">
              {privacy.map((p) => (
                <li key={p} className="opacity-90">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold">What&apos;s free</h2>
            <p className="mt-3 leading-7 text-muted">
              A free teacher account runs parent-teacher conferences, one published at a time. Planning a band contest,
              school fair, volunteer event or school visitor day?{" "}
              <Link href="/#join" className="font-medium text-brand underline">
                Request a pilot
              </Link>{" "}
              and we&apos;ll set up {brand.name} for your school.
            </p>
          </div>
        </section>

        <section className="bg-teal-deep text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight sm:text-4xl">Your conference link, ready today.</h2>
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
