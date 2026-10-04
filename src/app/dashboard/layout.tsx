import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
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
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-semibold">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-accent" />
            {brand.name}
          </Link>
          <div className="flex items-center gap-1 text-sm sm:gap-3">
            <Link href="/my" className="min-h-11 content-center whitespace-nowrap rounded-md px-2 text-muted hover:text-foreground sm:px-3">
              My shifts
            </Link>
            <Link href="/dashboard/account" className="min-h-11 content-center whitespace-nowrap rounded-md px-2 text-muted hover:text-foreground sm:px-3">
              <span className="hidden sm:inline">{user.email}</span>
              <span className="sm:hidden">Account</span>
            </Link>
            <form action="/auth/signout" method="post">
              <button className="min-h-11 whitespace-nowrap rounded-md px-2 text-muted hover:text-foreground sm:px-3">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
