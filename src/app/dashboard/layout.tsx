import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { hasPass, readPass } from "@/lib/volunteer-pass";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-muted">The database connection isn&apos;t set up yet (see docs/SETUP-GUIDE.md).</p>
      </main>
    );
  }
  const user = await requireUser();
  // "My shifts" only for people who volunteer: with this account's email, or
  // from this device (e.g. signed up with another email).
  const [{ count }, pass] = await Promise.all([
    (await createClient()).from("volunteers").select("id", { count: "exact", head: true }).eq("email", user.email ?? ""),
    readPass(),
  ]);
  const volunteers = Boolean(count) || hasPass(pass);

  return (
    <div className="flex flex-1 flex-col">
      <HeaderBar href="/dashboard">
        {volunteers && (
          <Link href="/my" className={headerLinkClass}>
            My shifts
          </Link>
        )}
        <Link href="/dashboard/account" className={headerLinkClass}>
          <span className="hidden sm:inline">{user.email}</span>
          <span className="sm:hidden">Account</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button className={headerLinkClass}>Sign out</button>
        </form>
      </HeaderBar>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
