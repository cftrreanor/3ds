import type { Metadata } from "next";
import Link from "next/link";
import { JumpLink } from "@/components/jump-link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { PublicBanners } from "@/components/site-banner";
import { publicBanners } from "@/lib/site-banners";
import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";
import { audiences, CONFERENCES_PAGE } from "@/lib/audiences";
import { SiteFooter } from "@/components/site-footer";
import { requestPilot } from "./pilot-actions";
import { PilotForm } from "./pilot-form";

// The page follows docs/brand-voice.md ("Homepage structure"): it routes
// people to the page for what they're organizing, and those pages sell.

const TAGLINE = "Every detail organized. Every organizer supported.";
const CONTACT = `mailto:${brand.supportEmail}`;

/** "What are you organizing?": one card per task, each linking to its pages. */
const router: { title: string; body: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Contests and festivals",
    body: "Schedules, rooms, check-in, and buses in one place",
    links: [
      { label: "Band contests", href: audiences.bands.path },
      { label: "Choir and group festivals", href: audiences.groups.path },
    ],
  },
  {
    title: "School events",
    body: "Theater, UIL academics, fairs, and more",
    links: [
      { label: "Theater, UIL, and group events", href: audiences.groups.path },
      { label: "School fairs and fundraisers", href: audiences.fairs.path },
      { label: "School volunteers", href: audiences.volunteers.path },
    ],
  },
  {
    title: "Classroom sign-ups",
    body: "Parties, conferences, and visits, ready in minutes",
    links: [
      { label: "Parent-teacher conferences", href: CONFERENCES_PAGE.path },
      { label: "Class parties and campus visits", href: audiences.parents.path },
    ],
  },
  {
    title: "For administrators",
    body: "Reliable events with less strain on your staff",
    links: [{ label: "Talk with us", href: CONTACT }],
  },
];

const different = [
  { title: "Organized", body: "everything for your event on one page" },
  { title: "Supported", body: "real people, not bots" },
  { title: "Respectful", body: "no ads and no spam for your families" },
];

const classroom = [
  { title: "One form for the whole family", body: "register every adult and every student at once" },
  { title: "One page, done", body: "no clicking through screen after screen" },
  { title: "No ads, no spam", body: "emails used for your event and nothing else" },
];

// "Supported" is a system, not a person on call: no phone numbers,
// response-time promises, or "always available" language.
const support = [
  {
    title: "Guidance built in",
    body: "Each kind of event walks you through setup one step at a time, and event-day screens show who's here and what's next.",
  },
  {
    title: "Quick answers",
    body: "Our pages for each kind of event answer the questions organizers ask most, in plain words.",
  },
  {
    title: "Real people when you need them",
    body: "Email us and a person on our team writes back. No bots.",
  },
];

const pilot = [
  {
    title: "What you get",
    items: [
      "Every feature, free during your pilot",
      "Unlimited events of every kind, volunteers, and registrations",
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
      "We'll talk with you about what comes next before your pilot ends",
      "Organizing events is a paid plan after your pilot, and we'll go over it with you first",
      "No platform fee for anyone you invite: volunteers, families, and visiting groups use it free",
    ],
  },
];

const JOIN = "#join" as const;
// Every button to the form says the same thing.
const CTA = "Join the pilot";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// What search engines and AI assistants read about the product.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: brand.name,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      email: brand.supportEmail,
      slogan: TAGLINE,
      address: { "@type": "PostalAddress", addressLocality: brand.city, addressRegion: brand.regionCode, addressCountry: "US" },
    },
    {
      "@type": "SoftwareApplication",
      name: brand.name,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Event organizing for schools: band contests, choir and group festivals, school fairs and fundraisers, volunteer events, school visitor days, and parent-teacher conferences, with registration, volunteer sign-ups, and check-in on any phone.",
      audience: {
        "@type": "Audience",
        audienceType:
          "PTO and PTA leaders, band and choir booster clubs, fine arts directors, band and choir directors, teachers, school front offices, and administrators",
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description:
          "Free for organizers during the pilot, then a paid plan for organizers. No platform fee for volunteers, families, or visiting groups.",
      },
    },
  ],
};

// Company banners for visitors (admin → Banners) refresh at least once a minute.
export const revalidate = 60;

/** Public banners, or none if the database isn't reachable (e.g. while building). */
async function homeBanners() {
  try {
    return await publicBanners();
  } catch {
    return [];
  }
}

const sectionTitle = "text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl";

export default async function Home() {
  const banners = await homeBanners();
  return (
    <div className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <HeaderBar maxWidth="max-w-6xl">
        <JumpLink href="#organizing" className={`hidden sm:block ${headerLinkClass}`}>
          What are you organizing?
        </JumpLink>
        <JumpLink href="#pilot" className={`hidden sm:block ${headerLinkClass}`}>
          Pilot details
        </JumpLink>
        <Link href="/login" className={headerLinkClass}>
          Sign in
        </Link>
        <JumpLink
          href={JOIN}
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-violet px-3 text-[13px] font-semibold sm:px-5 sm:text-sm text-header transition hover:opacity-90"
        >
          {CTA}
        </JumpLink>
      </HeaderBar>

      <main className="flex-1">
        <PublicBanners banners={banners} />

        {/* 1. Hero */}
        <section className={`hero-sky text-white ${banners.length ? "mt-4" : ""}`}>
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
            <h1 className="max-w-3xl text-4xl font-medium leading-[0.96] sm:text-6xl">{TAGLINE}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-on-dark-mute">
              Contests, school events, and simple sign-ups, with real people behind every one
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <JumpLink href={JOIN} className="rounded-full bg-violet px-6 py-3 font-semibold text-header hover:opacity-90">
                {CTA}
              </JumpLink>
            </div>
          </div>
        </section>

        {/* 2. Router: the homepage routes, the specialized pages sell */}
        <section id="organizing" tabIndex={-1} className="scroll-mt-20 border-b border-border bg-surface outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className={sectionTitle}>What are you organizing?</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {router.map((r) => (
                <li key={r.title} className="flex flex-col rounded-lg border border-border bg-background p-6">
                  <h3 className="text-lg font-semibold">{r.title}</h3>
                  <p className="mt-1 leading-7 text-muted">{r.body}</p>
                  <ul className="mt-auto space-y-1 pt-5">
                    {r.links.map((l) => (
                      <li key={l.label}>
                        <a href={l.href} className="inline-flex min-h-11 items-center font-medium text-brand underline">
                          {l.label}
                          <span aria-hidden>&nbsp;→</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. Why it's different */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className={sectionTitle}>Why it&apos;s different</h2>
          <dl className="mt-10 grid gap-8 sm:grid-cols-3">
            {different.map((d) => (
              <div key={d.title}>
                <dt className="text-xl font-semibold">{d.title}</dt>
                <dd className="mt-1 leading-7 text-muted">{d.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 4. Classroom sign-ups */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className={sectionTitle}>Sign-ups that respect everyone&apos;s time</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Classroom parties, parent-teacher conferences, and campus visits on one simple page
            </p>
            <dl className="mt-10 grid gap-8 sm:grid-cols-3">
              {classroom.map((c) => (
                <div key={c.title}>
                  <dt className="font-semibold">{c.title}</dt>
                  <dd className="mt-1 leading-7 text-muted">{c.body}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-1">
              <li>
                <Link href={CONFERENCES_PAGE.path} className="inline-flex min-h-11 items-center font-medium text-brand underline">
                  Parent-teacher conferences<span aria-hidden>&nbsp;→</span>
                </Link>
              </li>
              <li>
                <Link href={audiences.parents.path} className="inline-flex min-h-11 items-center font-medium text-brand underline">
                  Class parties and campus visits<span aria-hidden>&nbsp;→</span>
                </Link>
              </li>
            </ul>
          </div>
        </section>

        {/* 5. How support works */}
        <section id="support" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className={sectionTitle}>How support works</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Support starts in the product, so most questions never come up. When one does, a real person is behind it.
            </p>
            <dl className="mt-10 grid gap-8 sm:grid-cols-3">
              {support.map((s) => (
                <div key={s.title}>
                  <dt className="font-semibold">{s.title}</dt>
                  <dd className="mt-1 leading-7 text-muted">{s.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 leading-7">
              <a href={CONTACT} className="font-medium text-brand underline">
                {brand.supportEmail}
              </a>
            </p>
          </div>
        </section>

        {/* The pilot, and the form every "Join the pilot" button leads to */}
        <section id="pilot" tabIndex={-1} className="scroll-mt-20 border-t border-border bg-surface outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium">Limited spots</p>
            <h2 className={`mt-4 ${sectionTitle}`}>Join the pilot</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              We&apos;re working closely with a small group of schools, PTOs, and booster clubs. Your pilot is free, we
              set its dates together, and we keep the group small so we can support every organizer.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pilot.map((col) => (
                <div key={col.title} className="rounded-lg border border-border bg-background p-6">
                  <h3 className="font-semibold">{col.title}</h3>
                  <ul className="mt-3 space-y-2 leading-7 text-muted">
                    {col.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden className="text-success">
                          ✓
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div id="join" tabIndex={-1} className="mt-12 max-w-3xl scroll-mt-20 outline-none">
              <h3 className="text-xl font-semibold">{CTA}</h3>
              <p className="mt-1 text-muted">It takes a minute, and a person on our team will reply by email.</p>
              <div className="mt-6">
                <PilotForm action={requestPilot} />
              </div>
            </div>
          </div>
        </section>

        {/* 6. Closing call to action */}
        <section className="bg-teal-deep text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight sm:text-4xl">Ready for your next event</h2>
            <p className="mx-auto mt-4 max-w-xl text-on-dark-mute">Free during your pilot. Spots are limited.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <JumpLink href={JOIN} className="inline-flex rounded-md bg-white px-6 py-3 font-semibold text-teal-deep hover:opacity-90">
                {CTA}
              </JumpLink>
              <a
                href={CONTACT}
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
