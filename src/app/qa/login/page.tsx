import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { HeaderBar } from "@/components/logo";
import { Card } from "@/components/ui";
import { isQa } from "@/lib/qa";
import { safeNext } from "@/lib/safe-next";
import { PasscodeForm } from "./passcode-form";

export const metadata: Metadata = { title: "QA site", robots: { index: false, follow: false } };

/** The QA site's front door: a reviewer's passcode. */
export default async function QaLoginPage({ searchParams }: PageProps<"/qa/login">) {
  await connection(); // Read fresh on every visit, never at build time.
  if (!isQa()) redirect("/");
  const { next } = await searchParams;
  return (
    <>
      <HeaderBar maxWidth="max-w-md" />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <Card>
            <h1 className="text-2xl font-medium">QA site</h1>
            <p className="mt-2 text-muted">A private copy of the site with test data, for reviewing pages and copy. Enter your passcode to open it.</p>
            <div className="mt-6">
              <PasscodeForm next={safeNext(next) ?? undefined} />
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
