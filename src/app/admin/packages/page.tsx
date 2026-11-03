import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/admin";
import { loadTiers } from "@/lib/package-names";
import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "../kit";
import { PackagesGrid } from "./grid";

export const metadata: Metadata = { title: "Packages" };

/** What each package includes and costs, and each event pass's price. Changes apply to every account on the package. */
export default async function PackagesPage() {
  await requirePlatformAdmin();
  const [tiers, { data: orgs }] = await Promise.all([loadTiers(), createAdminClient().from("organizations").select("package")]);
  // Before the 20270114000000 update, packages have no prices yet: say what to run.
  if (!tiers.length || !("price_month_cents" in tiers[0])) {
    return (
      <div>
        <PageHeader title="Packages" />
        <p className="text-sm">
          This page needs a database update. Run <code>supabase/migrations/20270114000000_package_admin.sql</code> in the Supabase SQL Editor.
        </p>
      </div>
    );
  }
  const counts: Record<string, number> = {};
  for (const o of (orgs ?? []) as { package: string }[]) counts[o.package] = (counts[o.package] ?? 0) + 1;
  return (
    <div>
      <PageHeader
        title="Packages"
        sub="What each package includes and costs. Select a box to change it. Changes apply to every account on that package right away."
      />
      <PackagesGrid packages={tiers.filter((t) => t.kind === "package")} passes={tiers.filter((t) => t.kind === "pass")} counts={counts} />
    </div>
  );
}
