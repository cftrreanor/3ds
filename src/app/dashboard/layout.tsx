import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-muted">The database connection isn&apos;t set up yet (see docs/SETUP-GUIDE.md).</p>
      </main>
    );
  }
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <HeaderBar href="/dashboard">
        <Link href="/my" className={headerLinkClass}>
          My shifts
        </Link>
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
