import type { Metadata } from "next";
import Link from "next/link";
import { HeaderBar } from "@/components/logo";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

const LINK = "font-medium text-brand underline-offset-4 hover:underline";

/** Any address that doesn't lead anywhere: an old or mistyped link, or an event that's been removed. */
export default function NotFound() {
  return (
    <>
      <HeaderBar maxWidth="max-w-2xl" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">We can&apos;t find that page</h1>
        <p className="mt-3 leading-7 text-muted">
          The link may be old or mistyped, or the event may have been removed. If someone sent you this link, ask them for a fresh one.
        </p>
        <ul className="mt-8 space-y-3">
          <li>
            <Link href="/my" className={LINK}>
              My volunteering
            </Link>
            <span className="text-muted"> · your shifts and sign-ups</span>
          </li>
          <li>
            <Link href="/dashboard" className={LINK}>
              My events
            </Link>
            <span className="text-muted"> · for organizers</span>
          </li>
          <li>
            <Link href="/" className={LINK}>
              {brand.name} home
            </Link>
          </li>
        </ul>
        <p className="mt-8 text-sm text-muted">
          Still stuck? Email us at <span className="font-medium text-foreground select-all">{brand.supportEmail}</span>
        </p>
      </main>
    </>
  );
}
