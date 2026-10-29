"use client";

import { LeaveStepLink } from "../../_components/setup-leave";

export type ZoneTab = { key: string; name: string; booths: number; active: boolean; href: string; unzoned?: boolean };

/**
 * Booths & Partners: one tab per zone, like the sign-up tabs in Volunteer
 * Setup, then "+ Add zone". Leaving a tab with a booth half-edited asks first.
 */
export function ZoneTabs({ tabs, add }: { tabs: ZoneTab[]; add: { href: string; active: boolean } }) {
  return (
    <nav aria-label="Zones" className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((t) => (
          <li key={t.key}>
            <LeaveStepLink
              href={t.href}
              way="zone"
              scroll={false}
              current={t.active}
              className={`-mb-px flex flex-col border-b-2 px-4 py-2 text-sm ${
                t.active ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {t.booths > 0 && !t.unzoned ? (
                  <span aria-hidden className="font-bold text-success">
                    ✓
                  </span>
                ) : (
                  <span aria-hidden className="size-2.5 rounded-full bg-[#f5b301] ring-1 ring-warning/50" />
                )}
                {t.name}
              </span>
              <span className="text-xs font-normal tabular-nums text-muted">
                {t.unzoned ? `${t.booths} ${t.booths === 1 ? "needs" : "need"} a zone` : t.booths ? `${t.booths} ${t.booths === 1 ? "booth" : "booths"}` : "No booths yet"}
              </span>
            </LeaveStepLink>
          </li>
        ))}
        <li>
          <LeaveStepLink
            href={add.href}
            way="zone"
            scroll={false}
            current={add.active}
            className={`-mb-px flex h-full items-center whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              add.active ? "border-brand text-foreground" : "border-transparent text-brand hover:text-foreground"
            }`}
          >
            + Add zone
          </LeaveStepLink>
        </li>
      </ul>
    </nav>
  );
}
