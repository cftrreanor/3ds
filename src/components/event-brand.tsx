import { HeaderBar } from "@/components/logo";
import { PublicNav } from "./public-nav";
import { eventLogoUrl, loadEventBrand } from "@/lib/event-brand";

/** The header bar on an event's public pages: our logo, then the account's logo when there is one. */
export async function EventHeaderBar({ slug, maxWidth = "max-w-2xl", children }: { slug: string; maxWidth?: string; children?: React.ReactNode }) {
  const { logoPath } = await loadEventBrand(slug);
  const src = eventLogoUrl(slug, logoPath);
  return (
    <HeaderBar maxWidth={maxWidth} href={`/e/${slug}`} eventLogo={src ? { src, alt: "Organizer logo" } : null}>
      {children ?? <PublicNav />}
    </HeaderBar>
  );
}

/**
 * The event name, date, and place at the top of an event's main public pages.
 * With an account color (`band`), a full-width band in that color with white
 * text, placed above the page's main column; without one, the standard
 * heading inside it.
 */
export function EventHeading({
  band,
  eyebrow,
  title,
  children,
}: {
  band: boolean;
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      {eyebrow && <p className="mb-1 text-sm font-medium text-muted">{eyebrow}</p>}
      <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
      {children}
    </>
  );
  if (!band) return <header className="mt-6">{inner}</header>;
  return (
    <header className="event-band bg-[var(--band)] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">{inner}</div>
    </header>
  );
}
