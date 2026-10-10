import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ } from "@/lib/admin-crm";
import { createAdminClient } from "@/lib/supabase/server";
import { utcToZonedDate } from "@/lib/time";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" } };

/**
 * FieldCommand's own back office, laid out like a CRM: a sidebar, a search
 * box, and dense tables and record pages. Admins only.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requirePlatformAdmin();
  const admin = createAdminClient();
  const today = utcToZonedDate(new Date().toISOString(), ADMIN_TZ);
  const [{ count: newRequests }, { count: due }] = await Promise.all([
    admin.from("pilot_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("admin_notes").select("id", { count: "exact", head: true }).is("done_at", null).lte("follow_up_on", today),
  ]);

  const items = [
    { href: "/admin", label: "Home" },
    { href: "/admin/follow-ups", label: "Follow-ups", count: due ?? 0, alert: true },
    { href: "/admin/accounts", label: "Accounts" },
    { href: "/admin/people", label: "People" },
    { href: "/admin/pipeline", label: "Pipeline", count: newRequests ?? 0, alert: true },
    { href: "/admin/templates", label: "Email templates" },
    { href: "/admin/activity", label: "Activity" },
  ];

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <aside className="shrink-0 bg-header text-header-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-56 lg:flex-col">
        <div className="flex items-center justify-between gap-2 px-3 pt-2 lg:block lg:px-4 lg:pt-4">
          <Logo href="/admin" className="h-9 w-auto" />
          <p className="text-xs font-semibold tracking-wide text-on-dark-mute uppercase lg:mt-2">Admin</p>
        </div>
        <div className="px-2 py-2 lg:mt-4 lg:flex-1 lg:px-3">
          <AdminNav items={items} />
        </div>
        <div className="hidden border-t border-white/10 px-4 py-3 text-xs text-on-dark-mute lg:block">
          <p className="truncate" title={user.email ?? undefined}>
            {user.email}
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/dashboard" className="hover:text-white">
              My dashboard
            </Link>
            <form action="/auth/signout" method="post">
              <button className="hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur sm:px-6">
          <form action="/admin/search" role="search" className="flex-1">
            <input
              name="q"
              type="search"
              placeholder="Search accounts, people, pilot requests…"
              aria-label="Search the admin"
              className="h-8 w-full max-w-md rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
          </form>
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground lg:hidden">
            My dashboard
          </Link>
        </div>
        <main className="px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
