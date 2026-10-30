"use client";

import { LeaveStepLink } from "../../_components/setup-leave";
import { folderTab, folderTabNote, folderTabRow } from "@/components/folder-tabs";

export type ZoneTab = { key: string; name: string; booths: number; active: boolean; href: string; unzoned?: boolean };

/**
 * Booths & Partners: one tab per zone, like the sign-up tabs in Volunteer
 * Setup, then "+ Add zone". Leaving a tab with a booth half-edited asks first.
 */
export function ZoneTabs({ tabs, add }: { tabs: ZoneTab[]; add: { href: string; active: boolean } }) {
  return (
    <nav aria-label="Zones" className="relative -mx-4 overflow-x-auto px-4 pt-1 sm:mx-0 sm:px-0">
      <ul className={folderTabRow}>
        {tabs.map((t) => {
          const needs = !(t.booths > 0 && !t.unzoned);
          return (
          <li key={t.key}>
            <LeaveStepLink
              href={t.href}
              way="zone"
              scroll={false}
              current={t.active}
              className={folderTab(t.active)}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {!needs && <span aria-hidden>✓</span>}
                {t.name}
              </span>
              <span className={folderTabNote(needs)}>
                {needs && <span aria-hidden>◆ </span>}
                {t.unzoned ? `${t.booths} ${t.booths === 1 ? "needs" : "need"} a zone` : t.booths ? `${t.booths} ${t.booths === 1 ? "booth" : "booths"}` : "No booths yet"}
              </span>
            </LeaveStepLink>
          </li>
          );
        })}
        <li>
          <LeaveStepLink
            href={add.href}
            way="zone"
            scroll={false}
            current={add.active}
            className={`${folderTab(add.active)} justify-center`}
          >
            <span className="whitespace-nowrap font-semibold text-brand">+ Add zone</span>
          </LeaveStepLink>
        </li>
      </ul>
    </nav>
  );
}
