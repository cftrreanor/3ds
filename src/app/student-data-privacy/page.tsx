import type { Metadata } from "next";
import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { STUDENT_PRIVACY_PAGE } from "@/lib/audiences";
import { brand } from "@/lib/brand";

// The public answer to "how do you handle student data?", for district
// technology and legal teams. Keep it in step with docs/DATA-PRIVACY.md; every
// statement must match what the database actually does.

export const metadata: Metadata = {
  title: "Student Data Privacy",
  description: `What ${brand.name} collects about students and families, who can see it, where it's stored, and when it's deleted.`,
  alternates: { canonical: STUDENT_PRIVACY_PAGE.path },
};

const collected = [
  { event: "Band contests and group festivals", students: "None. Headcounts only.", adults: "Directors' names, school email addresses, and phone numbers" },
  {
    event: "Volunteer events",
    students: "Under-18 helpers: first name and last initial only, signed up by a parent or guardian",
    adults: "Volunteers' names, email addresses, and phone numbers",
  },
  { event: "School fairs", students: "None", adults: "Booth partners' contact details" },
  { event: "Family visitor days", students: "Each child's name, teacher, and grade", adults: "Parent's name, email address, and phone number" },
  {
    event: "Parent-teacher conferences",
    students: "The child's name, and the parent's optional note to the teacher",
    adults: "Parents' names, email addresses, and phone numbers",
  },
];

const deleted = [
  { what: "Children's details from family visitor days", when: "30 days after the event" },
  { what: "Parent-teacher conference bookings", when: "30 days after the conference" },
  { what: "Volunteers, including under-18 helpers", when: "10 days after the event" },
  { what: "Files shared with an event", when: "30 days after the event" },
  { what: "A closed account and everything in it", when: "90 days after it's closed" },
];

const providers = [
  { name: "Supabase", does: "Database, sign-in, and file storage, in the United States" },
  { name: "Vercel", does: "Hosts the website and app" },
  { name: "Resend", does: "Sends confirmation and reminder emails" },
  { name: "Sentry", does: "Error alerts, with names, email addresses, phone numbers, and form contents removed" },
  { name: "Cloudflare Turnstile", does: "The “not a robot” check on public forms" },
];

const h2 = "text-2xl font-medium leading-tight tracking-tight sm:text-3xl";

/** Student data privacy: the facts a district asks for before signing up. */
export default function StudentDataPrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <HeaderBar maxWidth="max-w-4xl">
        <Link href="/" className={`hidden sm:block ${headerLinkClass}`}>
          All event types
        </Link>
        <Link href="/login" className={headerLinkClass}>
          Sign in
        </Link>
      </HeaderBar>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-medium text-muted">{STUDENT_PRIVACY_PAGE.name}</p>
        <h1 className="mt-2 text-4xl font-medium leading-tight tracking-tight sm:text-5xl">Only what each event needs</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          Most events collect no student information at all. Where an event needs it, it&apos;s limited to a name, and for family visitor days
          the child&apos;s teacher and grade, and it&apos;s deleted 30 days after the event.
        </p>

        <section className="mt-12">
          <h2 className={h2}>What we collect</h2>
          <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
            {collected.map((c) => (
              <li key={c.event} className="grid gap-2 p-4 sm:grid-cols-[1fr_1.4fr_1.4fr] sm:gap-6">
                <span className="font-semibold">{c.event}</span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted">About students</span>
                  {c.students}
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted">About adults</span>
                  {c.adults}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 leading-7 text-muted">
            We never collect student ID numbers, dates of birth, home addresses, grades or scores, attendance, or health, discipline, or special
            education information, and students never have accounts.
          </p>
        </section>

        <section className="mt-12">
          <h2 className={h2}>Who can see it</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
            <li>Children&apos;s and families&apos; details: the event&apos;s organizers, and the check-in team on event day only</li>
            <li>Conference bookings: only the teacher</li>
            <li>Volunteers&apos; phone numbers: Section Leads on event day only</li>
            <li>Families never see who else registered or booked</li>
            <li>These rules are enforced inside the database, with an automated test for each one</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className={h2}>When it&apos;s deleted</h2>
          <p className="mt-3 leading-7 text-muted">Deletion runs automatically every day. Organizers can also delete an event at any time.</p>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {deleted.map((d) => (
              <li key={d.what} className="flex flex-col gap-1 p-4 sm:flex-row sm:justify-between sm:gap-6">
                <span>{d.what}</span>
                <span className="font-semibold">{d.when}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className={h2}>Who owns it</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
            <li>The school or organization running the event owns the information, and we store it for them</li>
            <li>We use it only to run their event: sign-ups, confirmations, reminders, and check-in</li>
            <li>We never sell it, never show ads, and never send marketing to families, students, or volunteers</li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className={h2}>Where it&apos;s stored, and who helps us run the service</h2>
          <p className="mt-3 leading-7 text-muted">
            Data is stored in the United States. These providers handle it only to run the service. We don&apos;t use advertising, analytics,
            or tracking services.
          </p>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {providers.map((p) => (
              <li key={p.name} className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
                <span className="font-semibold">{p.name}</span>
                <span>{p.does}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className={h2}>How it&apos;s protected</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
            <li>Encrypted in transit and at rest</li>
            <li>Database rules that keep each school&apos;s information separate, checked in a security review in October 2026</li>
            <li>Private links for families and volunteers that use long random keys</li>
            <li>Shared files opened through links that expire after 60 seconds</li>
            <li>Bot protection and sending limits on public forms</li>
          </ul>
        </section>

        <section className="mt-12 rounded-lg border border-border bg-surface p-6 sm:p-8">
          <h2 className={h2}>Data privacy agreements</h2>
          <p className="mt-3 leading-7">
            We work with districts on their data privacy agreements, including the Texas Student Privacy Alliance&apos;s agreement. Email us
            and a person on our team will send our district packet and answer your team&apos;s questions.
          </p>
          <a
            href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent("Data privacy agreement")}`}
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-brand px-5 font-semibold text-brand-foreground hover:opacity-90"
          >
            Email {brand.supportEmail}
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
