import Link from "next/link";
import { DemoBar } from "@/components/demo-bar";
import { SignOutButton } from "@/components/sign-out-button";
import { FeedbackLink } from "@/components/feedback-button";
import { HeaderMenu } from "@/components/header-menu";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { PrintRecordNote } from "@/components/print-record-note";
import { UserBanners } from "@/components/user-banners";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { hasUpcomingVolunteering } from "@/lib/my-volunteering";
import { trackingAccounts } from "@/lib/volunteer-tracking";

const MENU_ITEM = "flex min-h-11 w-full items-center rounded-md px-3 text-left text-white/90 hover:bg-white/10 hover:text-white";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-muted">The database connection isn&apos;t set up yet (see docs/SETUP-GUIDE.md).</p>
      </main>
    );
  }
  const user = await requireUser();
  // "My volunteering" only for people with volunteering still to come (see hasUpcomingVolunteering).
  const [volunteers, tracking] = await Promise.all([
    hasUpcomingVolunteering(true),
    // Hosts, Co-hosts, and Volunteer Leads.
    trackingAccounts(user.id),
  ]);

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
            <Link href="/my" className={`${headerLinkClass} hidden sm:block`}>
              My volunteering
            </Link>
          )}
          {tracking.length > 0 && (
            <Link href="/dashboard/volunteer-tracking" className={headerLinkClass}>
              <span className="hidden sm:inline">Volunteer tracking</span>
              <span className="sm:hidden">Volunteers</span>
            </Link>
          )}
          <Link href="/dashboard/account" className={`${headerLinkClass} hidden sm:block`}>
            Account
          </Link>
          <div className="hidden sm:block">
            <SignOutButton className={headerLinkClass} />
          </div>
          {/* Phones: Account and Sign out tuck into a menu. */}
          <div className="sm:hidden">
            <HeaderMenu>
              {volunteers && (
                <Link href="/my" className={MENU_ITEM}>
                  My volunteering
                </Link>
              )}
              <Link href="/dashboard/account" className={MENU_ITEM}>
                Account
              </Link>
              <FeedbackLink className={MENU_ITEM} />
              <SignOutButton className={MENU_ITEM} />
            </HeaderMenu>
          </div>
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
