import type { Metadata } from "next";
import Link from "next/link";
import { HeaderBar } from "@/components/logo";
import { Card } from "@/components/ui";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Update in progress", robots: { index: false } };

/** Where pages send people when the code is newer than the database (see lib/schema-check). */
export default function UpdateNeededPage() {
  return (
    <>
      <HeaderBar maxWidth="max-w-2xl" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">This page is being updated</h1>
        <p className="mt-3 leading-7 text-muted">
          {brand.name} was just updated, and its database needs a matching update before this page works. Nothing has been
          lost. Please try again in a few minutes.
        </p>
        <Card className="mt-8 space-y-3">
          <h2 className="font-semibold">Running {brand.name}?</h2>
          <ol className="list-decimal space-y-2 pl-5 leading-7">
            <li>
              On GitHub, open the newest file in <code className="rounded bg-background px-1">supabase/migrations</code> and
              copy it (<span className="font-medium">Copy raw file</span>).
            </li>
            <li>
              In Supabase, go to <span className="font-medium">SQL Editor → New query</span>, paste it and click{" "}
              <span className="font-medium">Run</span>.
            </li>
            <li>Come back and reload the page.</li>
          </ol>
          <p className="text-sm text-muted">
            The setup guide (<code className="rounded bg-background px-1">docs/SETUP-GUIDE.md</code>, &ldquo;Applying
            database updates&rdquo;) lists every update and which one to run next.
          </p>
        </Card>
        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/dashboard" className="font-medium text-brand underline-offset-4 hover:underline">
            Dashboard
          </Link>
          <Link href="/" className="font-medium text-brand underline-offset-4 hover:underline">
            Home page
          </Link>
        </p>
      </main>
    </>
  );
}
