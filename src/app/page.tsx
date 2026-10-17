import type { Metadata } from "next";
import Link from "next/link";
import { infoBox } from "@/components/audience-page";
import { CardCarousel } from "@/components/card-carousel";
import { FaqList } from "@/components/faq-list";
import { JumpLink } from "@/components/jump-link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { PublicBanners } from "@/components/site-banner";
import { publicBanners } from "@/lib/site-banners";
import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";
import { ADMINISTRATORS_PAGE, audiences, CONFERENCES_PAGE } from "@/lib/audiences";
import { SiteFooter } from "@/components/site-footer";
import { requestPilot } from "./pilot-actions";
import { PilotForm } from "./pilot-form";
import { PILOT_END_LABEL } from "@/lib/pilot";

// Copy follows docs/brand-voice.md. Each event card links to its own page,
// and those pages carry the How it works steps.

const TAGLINE = "Every detail organized. Every organizer supported.";
const CONTACT = `mailto:${brand.supportEmail}`;

// The kinds of event (src/lib/event-types.ts), as the page's main pitch.
const kinds = [
  {
    icon: CONFERENCES_PAGE.icon,
    title: "Parent-teacher conferences",
    href: CONFERENCES_PAGE.path,
    examples: "Fall and spring conferences, in person or on video",
    points: [
      "Families book their own meeting time from one link",
      "Calendar invites, a reminder the day before, and easy changes",
      "Only the teacher sees children's names",
    ],
  },
  {
    icon: "🎺",
    title: "Band contests",
    href: audiences.bands.path,
    examples: "Marching invitationals, jazz festivals, and solo & ensemble",
    points: [
      "Band registration with saved details, and easy one-tap registration for returning bands and directors",
      "Performance schedule, finals, and a live order for directors and spectators",
      "Keep track of bands throughout the event with personalized check-in stages",
    ],
  },
  {
    icon: "👥",
    title: "Choir & group festivals",
    href: audiences.groups.path,
    examples: "Choir and orchestra festivals, theater, UIL academics, and speech & debate",
    points: [
      "Groups register, then move through your rooms on a schedule built for you",
      "Arrived and Done taps keep every room on time",
      "Directors and families can follow each room live on their phones",
    ],
  },
  {
    icon: "🎪",
    title: "School fairs & fundraisers",
    href: audiences.fairs.path,
    examples: "Fall festivals, carnivals, and PTO fundraisers",
    points: [
      "Booths and community partners organized by zone",
      "Quick partner check-in on the day",
      "A public “What's at the event” page that thanks your partners",
    ],
  },
  {
    icon: "🙋",
    title: "Volunteer events",
    href: audiences.volunteers.path,
    examples: "Concessions, field day, book fairs, and school parking",
    points: [
      "Build stations and schedules with ease",
      "Volunteers sign up and get email confirmations, calendar invites, and day-before reminders, with no hassle and no ads",
      "Check in volunteers on any device, no extra app required",
    ],
  },
  {
    icon: "🏫",
    title: "Family visitor days",
    href: audiences.parents.path,
    examples: "Family lunches, class parties, open houses, performances, and award days",
    points: [
      "Parents register ahead with each child, teacher, and grade",
      "Reminders to bring a photo ID, and a calendar invite",
      "Easy parent and visitor check-in at the event door",
    ],
  },
  {
    icon: ADMINISTRATORS_PAGE.icon,
    title: "For administrators",
    href: ADMINISTRATORS_PAGE.path,
    examples: "Reliable events with less strain on your staff",
    points: [
      "Every kind of school event in one place, all year",
      "Confirmations and reminders sent for you, and check-in on any phone",
      "Families' details deleted on a set schedule",
    ],
    link: "More for administrators",
  },
];

// Each event-type card in the sideways row: most of a phone screen, about a third of a wide one.
const carouselCard = "w-[85%] shrink-0 snap-start sm:w-[60%] md:w-[44%] lg:w-[31%]";

const different = [
  { title: "Organized", body: "Everything for your event is on one page." },
  { title: "Supported", body: "Real people answer your questions, not bots." },
  { title: "Respectful", body: "Families sign up in minutes, with no account to make." },
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

// The principles behind every event's data (the database enforces each one).
const privacy = [
  {
    title: "Only what the event needs",
    body: "We ask for the least information that gets the job done: headcounts instead of student names, first name and last initial for under-18 helpers, and no accounts for families or spectators.",
  },
  {
    title: "Only who needs it",
    body: "Organizers, leads, and volunteers each see what their role requires. Contact details unlock for leads on event day, and children's names stay with your event team.",
  },
  {
    title: "Gone when it's over",
    body: "Volunteers' details are deleted 10 days after the event, and children's details from school visits after 30 days.",
  },
  {
    title: "No ads, no spam",
    body: `Emails go out only for your event, and there are no ads anywhere in ${brand.name}.`,
  },
];

// Plain answers to what organizers ask (and search for); also given to search
// engines and AI assistants as an FAQ (see jsonLd below).
const faqs = [
  {
    q: "Can I use this instead of an online form for parent check-in?",
    a: "Yes. For a school visitor event, parents register ahead with each child's name, teacher, and grade, and they get a reminder to bring a photo ID. Your front office checks every adult in at the door on any phone. Only your event team sees children's details, and they're deleted 30 days after the event.",
  },
  {
    q: "How do band and choir directors register for our contest or festival?",
    a: "Share one registration link. Directors register their band or group once, and returning directors reuse their saved details. They see their performance time or room schedule as soon as you publish it.",
  },
  {
    q: "How do volunteers sign up and get checked in?",
    a: "Share a link or QR code. Volunteers pick a shift on their phone without making an account, and they get a confirmation and a calendar invite. They're checked in at the desk with one tap, and walk-ups can fill open spots on the day.",
  },
  {
    q: "Can it run a school fair or PTO fundraiser?",
    a: "Yes. Organize booths and community partners by zone, check partners in as they arrive, staff volunteer stations with Station Coordinators, and share a public page of everything at the event that thanks your partners.",
  },
  {
    q: "Do volunteers, parents, or visiting directors have to pay or download an app?",
    a: `No app, and no platform fee. Only the school or organization running the event pays to use ${brand.name}. Everyone they invite (volunteers, parents and families, and visiting band and choir directors) uses ${brand.name} at no charge, right in their phone's web browser. Any registration fee or ticket price the event itself charges is set by the organizer and is separate from ${brand.name}.`,
  },
  {
    q: "How is student and family information handled?",
    a: "Band contests collect headcounts, not student names. Children's names at school visitor events are deleted 30 days after the event, and volunteers' details 10 days after. Section Leads see volunteers' phone numbers only on event day. No ads, no spam, and emails used only for your event.",
  },
  {
    q: "Who is it for?",
    a: "PTO and PTA leaders, band and choir booster clubs, fine arts directors, band and choir directors, teachers, school front offices, and administrators: anyone running a school event with volunteers, registrations, or check-in.",
  },
  {
    q: "What does it cost?",
    a: `Your pilot is free, and the pilot ends ${PILOT_END_LABEL}. After that, organizing events is a paid plan for the school or organization running them. We'll go over it with you before your pilot ends, and nothing charges automatically. There's never a platform fee for volunteers, families, or visiting groups. Any registration or ticket fees are your event's own.`,
  },
];

const pilot = [
  {
    title: "What you get",
    items: [
      `Every feature, free until the pilot ends ${PILOT_END_LABEL}`,
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
          `Free for organizers during the pilot, which ends ${PILOT_END_LABEL}, then a paid plan for organizers. No platform fee for volunteers, families, or visiting groups.`,
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
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
          Events
        </JumpLink>
        <JumpLink href="#faq" className={`hidden md:block ${headerLinkClass}`}>
          FAQ
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
            <h1 className="max-w-3xl text-4xl font-medium leading-[0.96] sm:text-6xl">School events without the clipboards</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-on-dark-mute">
              Contests, school events, and easy <span className="whitespace-nowrap">sign-ups</span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <JumpLink href={JOIN} className="rounded-full bg-violet px-6 py-3 font-semibold text-header hover:opacity-90">
                {CTA}
              </JumpLink>
            </div>
          </div>
        </section>

        {/* 2. One card per kind of event, each linking to its own page */}
        <section id="organizing" tabIndex={-1} className="scroll-mt-20 border-b border-border bg-surface outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className={sectionTitle}>What are you organizing?</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Choose your kind of event, and {brand.name} gives you the tools it needs.
            </p>
            <CardCarousel label="Kinds of school event" itemName="event types">
              {kinds.map((k) => (
                <li key={k.title} className={`${carouselCard} flex flex-col rounded-lg border border-border bg-background p-6 sm:p-8`}>
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
                  <Link href={k.href} className="mt-auto pt-6 font-medium text-brand underline">
                    {"link" in k ? k.link : `More about ${k.title.toLowerCase()}`}
                    <span aria-hidden> →</span>
                  </Link>
                </li>
              ))}
            </CardCarousel>
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

        {/* 4. How support works */}
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

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className={`rounded-lg p-8 sm:p-12 ${infoBox}`}>
            <h2 className={sectionTitle}>Privacy by default</h2>
            <dl className="mt-6 grid max-w-5xl gap-6 leading-7 sm:grid-cols-2">
              {privacy.map((p) => (
                <div key={p.title}>
                  <dt className="font-semibold">{p.title}</dt>
                  <dd className="mt-1 opacity-90">{p.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className={sectionTitle}>Questions schools ask</h2>
            <FaqList faqs={faqs} />
          </div>
        </section>

        {/* The pilot, and the form every "Join the pilot" button leads to */}
        <section id="pilot" tabIndex={-1} className="scroll-mt-20 border-t border-border bg-surface outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium">Limited spots</p>
            <h2 className={`mt-4 ${sectionTitle}`}>Join the pilot</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              We&apos;re working closely with a small group of schools, PTOs, and booster clubs. Your pilot is free until
              the pilot ends {PILOT_END_LABEL}, and we keep the group small so we can support every organizer.
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

        {/* 5. Closing call to action */}
        <section className="bg-teal-deep text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight sm:text-4xl">{TAGLINE}</h2>
            <p className="mx-auto mt-4 max-w-xl text-on-dark-mute">Free until {PILOT_END_LABEL}. Spots are limited.</p>
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
