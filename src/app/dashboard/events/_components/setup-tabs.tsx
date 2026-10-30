"use client";

import { useTabInView } from "@/components/use-tab-in-view";
import { LeaveStepLink } from "./setup-leave";
import { folderTab, folderTabNote, folderTabRow } from "@/components/folder-tabs";

export type SetupTab = {
  key: string;
  label: string;
  /** Under the label: "3 bands", "Saved", "Optional". */
  status: string;
  /** A check (done), a yellow dot (still to do), or neither. */
  mark?: "done" | "todo";
  href: string;
  active: boolean;
};

/**
 * A setup page's tabs, like the sign-up tabs in Volunteer Setup. Leaving a tab
 * with something half-edited asks first (the same window as the setup steps).
 */
export function SetupTabs({
  label,
  tabs,
  way = "tab",
}: {
  label: string;
  tabs: SetupTab[];
  /** What the window says: "invite" for a half-typed invitation (Team setup). */
  way?: "tab" | "invite";
}) {
  const row = useTabInView<HTMLElement>(tabs.find((t) => t.active)?.key);
  return (
    <nav ref={row} aria-label={label} className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className={folderTabRow}>
        {tabs.map((t) => (
          <li key={t.key}>
            <LeaveStepLink
              href={t.href}
              way={way}
              scroll={false}
              current={t.active}
              className={folderTab(t.active)}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {t.mark === "done" && <span aria-hidden>✓</span>}
                {t.label}
              </span>
              <span className={folderTabNote(t.mark === "todo")}>
                {t.mark === "todo" && <span aria-hidden>◆ </span>}
                {t.status}
              </span>
            </LeaveStepLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
