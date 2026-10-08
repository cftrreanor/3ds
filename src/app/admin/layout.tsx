import type { Metadata } from "next";
import Link from "next/link";
import { HeaderBar, headerLinkClass } from "@/components/logo";
import { requirePlatformAdmin } from "@/lib/admin";
import { AdminTabs } from "./tabs";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" } };

/** FieldCommand's own dashboard: organizations, plans, pilot requests. Admins only. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePlatformAdmin();
  return (
    <div className="flex flex-1 flex-col">
      <HeaderBar href="/admin">
        <Link href="/dashboard" className={headerLinkClass}>
          My dashboard
        </Link>
        <form action="/auth/signout" method="post">
          <button className={headerLinkClass}>Sign out</button>
        </form>
      </HeaderBar>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm font-semibold text-muted">FieldCommand admin</p>
        <AdminTabs />
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
