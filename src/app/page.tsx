import type { Metadata } from "next";
import Link from "next/link";
import { CardCarousel } from "@/components/card-carousel";
import { FaqList } from "@/components/faq-list";
import { JumpLink } from "@/components/jump-link";
import { PhoneFrame } from "@/components/phone-frame";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { PublicBanners } from "@/components/site-banner";
import { publicBanners } from "@/lib/site-banners";
import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";
import { audiences, CONFERENCES_PAGE } from "@/lib/audiences";
import { SiteFooter } from "@/components/site-footer";
import { requestPilot } from "./pilot-actions";
import { PilotForm } from "./pilot-form";

// The kinds of event (src/lib/event-types.ts), as the page's main pitch.
const kinds = [
  {
    icon: "🎺",
    title: "Band contests",
    href: audiences.bands.path,
    examples: "Marching invitationals, jazz festivals, solo & ensemble",
    points: [
      "Band registration with saved details, and easy one-tap registration for returning bands and directors",
      "Performance schedule, finals and a live order for directors and spectators",
      "Keep track of bands throughout the event with personalized check-in stages",
    ],
  },
  {
    icon: "👥",
    title: "Group events",
    href: audiences.groups.path,
    examples: "Choir and orchestra festivals, theater, speech & debate",
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
    examples: "Fall festivals, carnivals, PTO fundraisers",
    points: [
      "Booths and community partners organized by zone",
      "Quick partner check-in on the day",
      "A public \u201cWhat's at the event\u201d page that thanks your partners",
    ],
  },
  {
    icon: "🙋",
    title: "Volunteer events",
    href: audiences.volunteers.path,
    examples: "Concessions, field day, book fairs, school parking",
    points: [
      "Build stations and schedules with ease",
      "Volunteers sign up and get email confirmations, calendar invites and day-before reminders, without any hassle or advertisements",
      "Check in volunteers on any device, no additional app required",
    ],
  },
  {
    icon: "🏫",
    title: "School visitor events",
    href: audiences.parents.path,
    examples: "Family lunches, open houses, performances, award days",
    points: [
      "Parents register ahead with each child, teacher and grade",
      "Reminders to bring a photo ID, and a calendar invite",
      "Easy parent and visitor check-in at the event door",
    ],
  },
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
];

const features = [
  { title: "Sign-ups that run themselves", body: "Share one link or QR code. Capacity is enforced, confirmations and calendar invites go out on their own." },
  { title: "Registration on your schedule", body: "Open and close it by hand, or set a date and time for it to close on its own." },
  { title: "Your whole team, with the right access", body: "Hosts, Volunteer Leads and Section Leads each see what they need, and nothing they don't." },
  { title: "Public day of event details", body: "Post a banner for a schedule change or an emergency, and share parking maps or packets with exactly the people who need them." },
  {
    title: "Check-in on any device",
    body: "It's a web app, so it runs in the browser on any phone, tablet or laptop. Nothing to download or install: your team checks people in at the door or the desk with one tap.",
  },
  { title: "Numbers at a glance", body: "Who's registered, who's arrived and who's still to come, broken down the way you need it." },
];

// The principles behind every event's data (the database enforces each one).
const privacy = [
  {
    title: "Only what the event needs.",
    body: "We ask for the least information that gets the job done: headcounts instead of student names, first name and last initial for under-18 helpers, and no accounts for families or spectators.",
  },
  {
    title: "Only who needs it.",
    body: "Hosts, leads and volunteers each see what their role requires. Contact details unlock for leads on event day, and children's names stay with your event team.",
  },
  {
    title: "Gone when it's over.",
    body: "Volunteers' details are deleted 10 days after the event, and children's details from school visits after 30 days.",
  },
  {
    title: "Never sold, no ads.",
    body: `We never sell your data or the data of anyone you invite, and there are no ads anywhere in ${brand.name}.`,
  },
];

// Each step shows a phone screenshot (public/screens/, made-up sample data).
const steps = [
  {
    n: "1",
    title: "Pick the kind of event",
    body: "Band contest, group event, school fair, volunteer event or school visitor event.",
    screen: "/screens/pick-event-type-blue.webp",
    alt: "Choosing the kind of event: band contest, group event, volunteer event, school visitor event or school fair.",
  },
  {
    n: "2",
    title: "Set it up",
    body: "Dates, venue, stations and shifts, or registration questions.",
    screen: "/screens/set-up-shifts-blue.webp",
    alt: "Setting up a parking station with its morning and late-morning volunteer shifts.",
  },
  {
    n: "3",
    title: "Share a link or QR code",
    body: "Volunteers, bands, groups and parents sign up on their own phones.",
    screen: "/screens/volunteer-signup-blue.webp",
    alt: "A volunteer picking a shift on the event's sign-up page.",
  },
  {
    n: "4",
    title: "Run the day",
    body: "Check everyone in, see who's here, and post updates as things change.",
    screen: "/screens/event-day-dashboard-blue.webp",
    alt: "The contest day dashboard: a schedule-change banner and how many bands have parked, checked in and warmed up.",
  },
];

const pilot = [
  {
    title: "What you get",
    items: [
      "Every feature, free during your pilot",
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
      "We'll talk with you about what comes next before your pilot ends",
      "Hosting is a paid plan after your pilot; we'll go over it with you first",
      "No platform fee for anyone you invite: volunteers, families and visiting groups use it free (your own registration or ticket fees are still up to you)",
    ],
  },
];

// Plain answers to what hosts ask (and search for); also given to search
// engines and AI assistants as an FAQ (see jsonLd below).
const faqs = [
  {
    q: "Can I use this instead of a Google Form for parent check-in?",
    a: "Yes. For a school visitor event, parents register ahead with each child's name, teacher and grade, get a reminder to bring a photo ID, and your front office checks every adult in at the door on any phone. Children's details are seen only by your event team and are deleted 30 days after the event.",
  },
  {
    q: "How do band and choir directors register for our contest or festival?",
    a: "Share one registration link. Directors register their band or group once, returning directors reuse their saved details, and they see their performance time or room schedule as soon as you publish it.",
  },
  {
    q: "How do volunteers sign up and get checked in?",
    a: "Share a link or QR code. Volunteers pick a shift on their phone without making an account, get a confirmation and calendar invite, and are checked in at the desk with one tap. Walk-ups can fill open spots on the day.",
  },
  {
    q: "Can it run a school fair or PTO fundraiser?",
    a: "Yes. Organize booths and community partners by zone, check partners in as they arrive, staff volunteer stations with Station Coordinators, and share a public page of everything at the event that thanks your partners.",
  },
  {
    q: "Do volunteers, parents or visiting directors have to pay or download an app?",
    a: `No app, and no platform fee. Only the school or organization hosting the event pays to use ${brand.name}. Everyone they invite (volunteers, parents and families, and visiting band and choir directors) uses ${brand.name} at no charge, right in their phone's web browser. Any registration fee or ticket price the event itself charges is set by the host and is separate from ${brand.name}.`,
  },
  {
    q: "How is student and family information protected?",
    a: "Band contests collect headcounts, not student names. Children's names at school visitor events are deleted 30 days after the event, volunteers' details 10 days after, and Section Leads see volunteers' phone numbers only on event day. We never sell anyone's data, and there are no ads.",
  },
  {
    q: "Who is it for?",
    a: "PTO and PTA leaders, band and choir booster clubs, fine arts directors, band and choir directors, school front offices and administrators: anyone running a school event with volunteers, registrations or check-in.",
  },
  {
    q: "What does it cost?",
    a: `Hosting is free during your pilot, with dates we set together. After that, hosting events is a paid plan for the school or organization running them. We'll go over it with you before your pilot ends, and nothing charges automatically. There's never a platform fee for volunteers, families or visiting groups; any registration or ticket fees are your event's own.`,
  },
];

// Each event-type card in the sideways row: most of a phone screen, about a third of a wide one.
const carouselCard = "w-[85%] shrink-0 snap-start sm:w-[60%] md:w-[44%] lg:w-[31%]";

// Each "How it works" step: most of a phone screen, all four side by side on a wide one.
const stepCard = "w-[75%] shrink-0 snap-start sm:w-[42%] lg:w-[calc((100%-4.5rem)/4)]";

const JOIN = "#join" as const;
// Every button to the form says the same thing.
const CTA = "Request a pilot spot";

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
      address: { "@type": "PostalAddress", addressLocality: brand.city, addressRegion: brand.regionCode, addressCountry: "US" },
    },
    {
      "@type": "SoftwareApplication",
      name: brand.name,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "School event management for band contests, choir and group festivals, school fairs and fundraisers, volunteer events, school visitor days and parent-teacher conferences: registration, volunteer sign-ups and scheduling, and check-in on any phone.",
      audience: {
        "@type": "Audience",
        audienceType:
          "PTO and PTA leaders, band and choir booster clubs, fine arts directors, band and choir directors, school front offices and administrators",
      },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free for hosts during the pilot, then a paid plan for hosts. No platform fee for volunteers, families or visiting groups (event registration or ticket fees are set by the host)." },
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

export default async function Home() {
  const banners = await homeBanners();
  return (
    <div className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <HeaderBar maxWidth="max-w-6xl">
        <JumpLink href="#how" className={`hidden sm:block ${headerLinkClass}`}>
          How it works
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
        <section className={`hero-sky text-white ${banners.length ? "mt-4" : ""}`}>
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/20">
              Now inviting schools, PTOs and booster clubs to our pilot
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-[0.96] sm:text-6xl">School events, without the clipboards.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-on-dark-mute">
              Band contests, choir and group festivals, school fairs, volunteer events, school visitor days and
              parent-teacher conferences, all in one place. Replace the spreadsheets, signup forms, group texts and paper sign-in sheets
              with simple links your volunteers, visiting groups and parents use on their own phones, and keep
              everyone&apos;s personal information private while you do it.
            </p>
            <p className="mt-4 max-w-2xl text-on-dark-mute">
              One tool for the whole school year, for band and choir programs, booster clubs, PTOs and front
              offices. Free during your pilot; spots are limited.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <JumpLink href={JOIN} className="rounded-full bg-violet px-6 py-3 font-semibold text-header hover:opacity-90">
                {CTA}
              </JumpLink>
              <JumpLink href="#how" className="rounded-md px-5 py-3 font-medium text-white ring-1 ring-white/30 hover:bg-white/10">
                See how it works
              </JumpLink>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">One platform for every kind of school event</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Choose what kind of event you&apos;re running and {brand.name} gives you exactly the tools it needs.
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
                    More about {k.title.toLowerCase()}
                    <span aria-hidden> →</span>
                  </Link>
                </li>
              ))}
            </CardCarousel>
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

        <section id="how" tabIndex={-1} className="scroll-mt-20 border-t border-border outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">How it works</h2>
            <CardCarousel label="How it works, step by step" itemName="steps" ordered>
              {steps.map((s) => (
                <li key={s.n} className={`${stepCard} flex flex-col`}>
                  <div className="flex-1">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-semibold text-brand-foreground">
                      {s.n}
                    </span>
                    <h3 className="mt-4 font-semibold">{s.title}</h3>
                    <p className="mt-1 leading-7 text-muted">{s.body}</p>
                  </div>
                  <PhoneFrame src={s.screen} alt={s.alt} className="mt-6 w-full max-w-[260px]" />
                </li>
              ))}
            </CardCarousel>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-lg bg-brand p-8 text-brand-foreground sm:p-12">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Privacy by default</h2>
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
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Questions schools ask</h2>
            <FaqList faqs={faqs} />
          </div>
        </section>

        <section id="about" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Who we are</h2>
            <p className="mt-6 max-w-2xl leading-7 text-muted">
              {brand.name} is a small team based in {brand.city}, {brand.region}. We build it alongside the schools,
              PTOs and booster clubs in our pilot, so you&apos;ll work directly with the people making it.
            </p>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              Questions? Email us at{" "}
              <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand underline">
                {brand.supportEmail}
              </a>
              .
            </p>
          </div>
        </section>

        <section id="pilot" tabIndex={-1} className="scroll-mt-20 border-t border-border bg-surface outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium">Limited spots</p>
            <h2 className="mt-4 text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Join the pilot</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              We&apos;re working closely with a small group of schools, PTOs and booster clubs. Your pilot is free,
              we set its dates together, and we keep the group small so we can support every host on event day.
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

            <div id="join" tabIndex={-1} className="mt-12 max-w-3xl scroll-mt-20 outline-none">
              <h3 className="text-xl font-semibold">{CTA}</h3>
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
            <p className="mx-auto mt-4 max-w-xl text-on-dark-mute">Free during your pilot. Spots are limited.</p>
            <JumpLink href={JOIN} className="mt-8 inline-flex rounded-md bg-white px-6 py-3 font-semibold text-teal-deep hover:opacity-90">
              {CTA}
            </JumpLink>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
