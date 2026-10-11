import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ, stamp } from "@/lib/admin-crm";
import { audienceLabel, BANNER_COLUMNS, HOST_FILTERS, hostFilterLabel, type SiteBanner } from "@/lib/banner-types";
import { hostMatches } from "@/lib/site-banners";
import { createAdminClient } from "@/lib/supabase/server";
import { utcToZonedDate, utcToZonedTime } from "@/lib/time";
import { loadAccounts } from "../data";
import { EmptyRow, PageHeader, Panel, secondarySmall, Table, Tag, Td, Th, Tr } from "../kit";
import { deleteBanner, endBanner, saveBanner } from "./actions";
import { BannerBuilder } from "./banner-builder";

export const metadata: Metadata = { title: "Banners" };

/** ISO → "2026-10-12T08:00" in the admin time zone, for datetime-local inputs. */
const local = (iso: string | null) => (iso ? `${utcToZonedDate(iso, ADMIN_TZ)}T${utcToZonedTime(iso, ADMIN_TZ)}` : "");

function status(b: SiteBanner, now: number) {
  if (b.ends_at && Date.parse(b.ends_at) <= now) return { label: "Ended", tone: "neutral" as const };
  if (Date.parse(b.starts_at) > now) return { label: "Scheduled", tone: "brand" as const };
  return { label: "Live", tone: "success" as const };
}

/**
 * Company banners: short notices at the top of the site for one group at a
 * time (hosts, directors, event teams or visitors), instead of emailing everyone.
 */
export default async function BannersPage({ searchParams }: PageProps<"/admin/banners">) {
  await requirePlatformAdmin();
  const { edit } = await searchParams;
  const admin = createAdminClient();
  const [{ data }, { data: closedData }, accounts, { data: bandData }, { data: staffData }] = await Promise.all([
    admin.from("site_banners").select(BANNER_COLUMNS).order("starts_at", { ascending: false }),
    admin.from("site_banner_dismissals").select("banner_id"),
    loadAccounts(),
    admin.from("bands").select("director_user_id"),
    admin.from("event_staff").select("user_id"),
  ]);
  const banners = (data ?? []) as SiteBanner[];
  const closed = ((closedData ?? []) as { banner_id: string }[]).reduce<Record<string, number>>(
    (m, r) => ((m[r.banner_id] = (m[r.banner_id] ?? 0) + 1), m),
    {},
  );
  const now = new Date().getTime();
  const editing = typeof edit === "string" ? banners.find((b) => b.id === edit) : undefined;

  // How many people each audience reaches (hosts per filter: every host of a matching account).
  const reach: Record<string, number> = {
    directors: new Set(((bandData ?? []) as { director_user_id: string }[]).map((b) => b.director_user_id)).size,
    teams: new Set(((staffData ?? []) as { user_id: string }[]).map((s) => s.user_id)).size,
  };
  for (const f of HOST_FILTERS) {
    const people = new Set<string>();
    for (const a of accounts) if (hostMatches(f.value, a)) a.organization_members.forEach((m) => people.add(m.user_id));
    reach[`hosts:${f.value}`] = people.size;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banners"
        sub="Short notices at the top of the site for one group at a time: hosts (by plan), directors, event teams or visitors. Banners only; nothing is emailed."
        actions={
          editing && (
            <Link href="/admin/banners#builder" className={secondarySmall}>
              New banner
            </Link>
          )
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Headline</Th>
            <Th>Who sees it</Th>
            <Th>Status</Th>
            <Th>Runs</Th>
            <Th className="text-right">Closed by</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {banners.map((b) => {
            const s = status(b, now);
            return (
              <Tr key={b.id} className={editing?.id === b.id ? "bg-brand-soft hover:bg-brand-soft" : ""}>
                <Td>
                  <span className="font-medium">{b.title}</span>
                  {b.tone === "urgent" && (
                    <span className="ml-2">
                      <Tag tone="danger">Urgent</Tag>
                    </span>
                  )}
                </Td>
                <Td className="text-muted">
                  {audienceLabel(b.audience)}
                  {b.audience === "hosts" && b.host_filter !== "all" && <span className="block text-xs">{hostFilterLabel(b.host_filter)}</span>}
                </Td>
                <Td>
                  <Tag tone={s.tone}>{s.label}</Tag>
                </Td>
                <Td className="text-xs whitespace-nowrap text-muted">
                  {stamp(b.starts_at)} → {b.ends_at ? stamp(b.ends_at) : "no end"}
                </Td>
                <Td className="text-right">{closed[b.id] ?? 0}</Td>
                <Td className="text-right">
                  <Link href={`/admin/banners?edit=${b.id}#builder`} className="text-sm font-semibold text-brand hover:underline">
                    {editing?.id === b.id ? "Editing" : "Edit"}
                  </Link>
                </Td>
              </Tr>
            );
          })}
          {banners.length === 0 && <EmptyRow cols={6}>No banners yet. Write your first one below.</EmptyRow>}
        </tbody>
      </Table>

      <section id="builder" className="scroll-mt-16">
        <Panel title={editing ? `Editing “${editing.title}”` : "New banner"}>
          <BannerBuilder
            key={editing?.id ?? "new"}
            action={saveBanner}
            banner={editing ? { ...editing, startsLocal: local(editing.starts_at), endsLocal: local(editing.ends_at) } : undefined}
            reach={reach}
            defaults={{ startsLocal: local(new Date(now).toISOString()), endsLocal: local(new Date(now + 14 * 864e5).toISOString()) }}
            onEnd={editing && status(editing, now).label !== "Ended" ? endBanner.bind(null, editing.id) : undefined}
            onDelete={editing ? deleteBanner.bind(null, editing.id) : undefined}
          />
        </Panel>
      </section>
    </div>
  );
}
