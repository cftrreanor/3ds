import Link from "next/link";
import { DemoBar } from "@/components/demo-bar";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { PrintRecordNote } from "@/components/print-record-note";
import { UserBanners } from "@/components/user-banners";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
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
  // "My shifts" only for people with a shift still coming up: with this
  // account's email, or booked from this device (e.g. with another email).
  // The same two lookups as the My shifts page; past shifts don't count.
  const pass = await readPass();
  const [fromAccount, fromPass] = await Promise.all([
    (await createClient()).rpc("my_agenda"),
    hasPass(pass)
      ? createAdminClient().rpc("pass_agenda", { p_volunteer_tokens: pass.v, p_assignment_tokens: pass.a })
      : Promise.resolve({ data: [] }),
  ]);
  const volunteers = anyUpcoming([...((fromAccount.data ?? []) as { ends_at: string }[]), ...((fromPass.data ?? []) as { ends_at: string }[])]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="contents print:hidden">
        <DemoBar />
        <HeaderBar href="/dashboard">
          <Link href="/dashboard" className={headerLinkClass}>
            <span className="hidden sm:inline">My events</span>
            <span className="sm:hidden">Events</span>
          </Link>
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
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <UserBanners userId={user.id} />
        {children}
        <PrintRecordNote />
      </main>
    </div>
  );
}

/** At least one shift that hasn't ended yet. */
function anyUpcoming(shifts: { ends_at: string }[]) {
  const now = Date.now();
  return shifts.some((s) => new Date(s.ends_at).getTime() >= now);
}
