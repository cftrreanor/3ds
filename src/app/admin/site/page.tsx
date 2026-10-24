import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ } from "@/lib/admin-crm";
import { isSchemaError, missing } from "@/lib/schema-check";
import { MARKETING_PAGES, pageLabel } from "@/lib/site-metrics";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { EmptyRow, PageHeader, Panel, Table, Td, Th, Tr } from "../kit";

export const metadata: Metadata = { title: "Site visits" };

type Row = { day: string; path: string; source: string; event: "view" | "pilot_open" | "pilot_sent"; count: number };
type Tally = { views: number; opens: number; sent: number };

const RANGES = [7, 30, 90] as const;

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

function tallyBy(rows: Row[], key: (r: Row) => string) {
  const out = new Map<string, Tally>();
  for (const r of rows) {
    const t = out.get(key(r)) ?? { views: 0, opens: 0, sent: 0 };
    if (r.event === "view") t.views += r.count;
    else if (r.event === "pilot_open") t.opens += r.count;
    else t.sent += r.count;
    out.set(key(r), t);
  }
  return out;
}

/** Visits to the marketing pages and the pilot form, counted by us (src/lib/site-metrics.ts). */
export default async function AdminSitePage({ searchParams }: PageProps<"/admin/site">) {
  await requirePlatformAdmin();
  const { days: daysParam } = await searchParams;
  const days = RANGES.find((r) => String(r) === daysParam) ?? 30;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ADMIN_TZ }).format(new Date());
  const start = addDays(today, -(days - 1));

  const { data, error } = await createAdminClient()
    .from("site_metrics")
    .select("day, path, source, event, count")
    .gte("day", start)
    .order("day")
    .limit(20000);
  if (isSchemaError(error)) missing();
  const rows = (data ?? []) as Row[];

  const total = tallyBy(rows, () => "all").get("all") ?? { views: 0, opens: 0, sent: 0 };
  const byDay = tallyBy(rows, (r) => r.day);
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(start, i);
    return { day, views: byDay.get(day)?.views ?? 0 };
  });
  const peak = Math.max(1, ...series.map((s) => s.views));
  const byPage = [...tallyBy(rows, (r) => r.path)].sort((a, b) => b[1].views - a[1].views || b[1].sent - a[1].sent);
  const bySource = [...tallyBy(rows, (r) => r.source)].sort((a, b) => b[1].views - a[1].views || b[1].sent - a[1].sent);
  const short = (day: string) => formatDate(day, { weekday: undefined, year: undefined });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Site visits"
        sub="Visits to the marketing pages and the pilot form. Counted by us, with no cookies and nothing about who visited. Visits from people signed in (like you) aren't counted."
        actions={
          <div className="flex gap-1" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`?days=${r}`}
                aria-current={r === days ? "page" : undefined}
                className={`rounded-md border px-2.5 py-1 text-sm ${r === days ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface hover:bg-background"}`}
              >
                {r} days
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Visits", value: total.views, note: `in the last ${days} days` },
          { label: "Started the pilot form", value: total.opens, note: `${pct(total.opens, total.views)} of visits` },
          { label: "Pilot requests sent", value: total.sent, note: `${pct(total.sent, total.opens)} of those who started` },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{s.value.toLocaleString("en-US")}</p>
            <p className="text-sm text-muted">{s.note}</p>
          </div>
        ))}
      </div>

      <Panel title="Visits by day">
        <div className="flex gap-2">
          <div className="flex h-40 flex-col justify-between text-right text-xs text-muted tabular-nums" aria-hidden>
            <span>{peak}</span>
            <span>0</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex h-40 items-end gap-[2px] border-b border-border" role="img" aria-label={`Visits per day, ${short(start)} to ${short(today)}. Highest: ${peak}.`}>
              {series.map((s) => (
                <div key={s.day} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none" aria-label={`${short(s.day)}: ${s.views} visits`}>
                  <div
                    className="w-full rounded-t-[4px] bg-brand group-hover:opacity-80 group-focus:opacity-80"
                    style={{ height: s.views ? `${Math.max(2, (s.views / peak) * 100)}%` : 0 }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background group-hover:block group-focus:block">
                    {short(s.day)}: {s.views} {s.views === 1 ? "visit" : "visits"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>{short(start)}</span>
              <span>{short(today)}</span>
            </div>
          </div>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-brand">Show as a table</summary>
          <Table className="mt-2 max-h-72 overflow-y-auto">
            <thead>
              <tr>
                <Th>Day</Th>
                <Th className="text-right">Visits</Th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((s) => (
                <Tr key={s.day}>
                  <Td>{short(s.day)}</Td>
                  <Td className="text-right">{s.views}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </details>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By page" flush>
          <Table className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Page</Th>
                <Th className="text-right">Visits</Th>
                <Th className="text-right">Started form</Th>
                <Th className="text-right">Sent</Th>
              </tr>
            </thead>
            <tbody>
              {byPage.map(([path, t]) => (
                <Tr key={path}>
                  <Td>
                    <a href={path} target="_blank" rel="noreferrer" className="hover:text-brand hover:underline">
                      {pageLabel(path)}
                    </a>
                  </Td>
                  <Td className="text-right">{t.views}</Td>
                  <Td className="text-right">{t.opens}</Td>
                  <Td className="text-right">{t.sent}</Td>
                </Tr>
              ))}
              {byPage.length === 0 && <EmptyRow cols={4}>No visits counted yet.</EmptyRow>}
            </tbody>
          </Table>
        </Panel>

        <Panel title="Where visitors came from" flush>
          <Table className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Source</Th>
                <Th className="text-right">Visits</Th>
                <Th className="text-right">Started form</Th>
                <Th className="text-right">Sent</Th>
              </tr>
            </thead>
            <tbody>
              {bySource.map(([source, t]) => (
                <Tr key={source}>
                  <Td>{source}</Td>
                  <Td className="text-right">{t.views}</Td>
                  <Td className="text-right">{t.opens}</Td>
                  <Td className="text-right">{t.sent}</Td>
                </Tr>
              ))}
              {bySource.length === 0 && <EmptyRow cols={4}>No visits counted yet.</EmptyRow>}
            </tbody>
          </Table>
        </Panel>
      </div>

      <p className="text-sm text-muted">
        Counted pages: {MARKETING_PAGES.map((p) => p.label).join(", ")}. A visit counts once per page per browser tab, so reloading doesn&apos;t add more. Campaign
        links can add <code className="rounded bg-background px-1">?utm_source=newsletter</code> (or any name) to show up by name here.
      </p>
    </div>
  );
}
