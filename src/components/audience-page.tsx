import type { Metadata } from "next";
import Link from "next/link";
import { requestPilot } from "@/app/pilot-actions";
import { PilotForm } from "@/app/pilot-form";
import { FaqList } from "@/components/faq-list";
import { JumpLink } from "@/components/jump-link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { AUDIENCES, type Audience } from "@/lib/audiences";
import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";

const CTA = "Request a pilot spot";

/** Title, description and address for one event type's page. */
export function audienceMetadata(a: Audience): Metadata {
  return {
    title: a.metaTitle,
    description: a.metaDescription,
    alternates: { canonical: a.path },
    // Setting openGraph replaces the layout's (and the site's share image), so repeat them.
    openGraph: {
      type: "website",
      siteName: brand.name,
      url: a.path,
      title: a.metaTitle,
      description: a.metaDescription,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: brand.name }],
    },
  };
}

/** One kind of school event, for the people who run it, with its own FAQ and the pilot form. */
export function AudiencePage({ audience: a }: { audience: Audience }) {
  const url = `${SITE_URL}${a.path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: a.metaTitle,
        url,
        description: a.metaDescription,
        about: { "@type": "SoftwareApplication", name: brand.name, url: SITE_URL, applicationCategory: "BusinessApplication", operatingSystem: "Web" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: brand.name, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: a.name, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: a.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  const others = AUDIENCES.filter((o) => o.path !== a.path);

  return (
    <div className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <HeaderBar maxWidth="max-w-6xl">
        <Link href="/" className={`hidden sm:block ${headerLinkClass}`}>
          All event types
        </Link>
        <Link href="/login" className={headerLinkClass}>
          Sign in
        </Link>
        <JumpLink
          href="#join"
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-violet px-3 text-[13px] font-semibold text-[#1b1938] transition hover:opacity-90 sm:px-5 sm:text-sm"
        >
          {CTA}
        </JumpLink>
      </HeaderBar>

      <main className="flex-1">
        <section className="hero-sky text-white">
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/20">
              <span aria-hidden>{a.icon}</span>
              {a.eyebrow}
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-[0.96] sm:text-6xl">{a.headline}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-on-dark-mute">{a.intro}</p>
            <p className="mt-4 max-w-2xl text-on-dark-mute">
              <span className="font-semibold text-white">Made for:</span> {a.examples}.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <JumpLink href="#join" className="rounded-full bg-violet px-6 py-3 font-semibold text-[#1b1938] hover:opacity-90">
                {CTA}
              </JumpLink>
              <JumpLink href="#faq" className="rounded-md px-5 py-3 font-medium text-white ring-1 ring-white/30 hover:bg-white/10">
                Common questions
              </JumpLink>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-xl font-semibold">What it replaces</h2>
            <ul className="mt-5 grid gap-x-8 gap-y-3 leading-7 sm:grid-cols-2">
              {a.replaces.map((r) => (
                <li key={r} className="flex gap-2 text-muted">
                  <span aria-hidden className="text-danger">
                    ✕
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto max-w-6xl divide-y divide-border px-4 sm:px-6">
          {a.sections.map((s) => (
            <section key={s.title} className="grid gap-4 py-12 md:grid-cols-[2fr_3fr] md:gap-10">
              <h2 className="text-2xl font-medium leading-tight tracking-tight sm:text-3xl">{s.title}</h2>
              <div>
                <p className="leading-7">{s.body}</p>
                {s.points.length > 0 && (
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
                )}
              </div>
            </section>
          ))}
        </div>

        <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
          <div className="rounded-lg bg-brand p-8 text-brand-foreground sm:p-12">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-4xl">Who sees what</h2>
            <ul className="mt-6 grid max-w-5xl gap-4 leading-7 sm:grid-cols-2">
              {a.privacy.map((p) => (
                <li key={p} className="opacity-90">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" tabIndex={-1} className="scroll-mt-20 border-t border-border outline-none">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">Common questions</h2>
            <FaqList faqs={a.faqs} />
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-xl font-semibold">One account for every school event</h2>
            <p className="mt-2 max-w-2xl leading-7 text-muted">
              The same {brand.name} account runs every kind of event, all year.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((o) => (
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
              Hosting is free during your pilot, and we set its dates together. Volunteers, families and visiting groups
              never pay a platform fee.{" "}
              <Link href="/#pilot" className="text-brand underline">
                See the pilot details
              </Link>
              .
            </p>
            <div className="mt-8">
              <PilotForm action={requestPilot} defaultEventTypes={[a.eventType]} />
            </div>
          </div>
        </section>

        <section className="bg-teal-deep text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight sm:text-4xl">Your next event, without the clipboards.</h2>
            <p className="mx-auto mt-4 max-w-xl text-on-dark-mute">Free during your pilot. Spots are limited.</p>
            <JumpLink href="#join" className="mt-8 inline-flex rounded-md bg-white px-6 py-3 font-semibold text-teal-deep hover:opacity-90">
              {CTA}
            </JumpLink>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
