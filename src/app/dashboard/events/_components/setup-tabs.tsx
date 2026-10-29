"use client";

import { useTabInView } from "@/components/use-tab-in-view";
import { LeaveStepLink } from "./setup-leave";

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
export function SetupTabs({ label, tabs }: { label: string; tabs: SetupTab[] }) {
  const row = useTabInView<HTMLElement>(tabs.find((t) => t.active)?.key);
  return (
    <nav ref={row} aria-label={label} className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((t) => (
          <li key={t.key}>
            <LeaveStepLink
              href={t.href}
              way="tab"
              scroll={false}
              current={t.active}
              className={`-mb-px flex flex-col border-b-2 px-4 py-2 text-sm ${
                t.active ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {t.mark === "done" && (
                  <span aria-hidden className="font-bold text-success">
                    ✓
                  </span>
                )}
                {t.mark === "todo" && <span aria-hidden className="size-2.5 rounded-full bg-[#f5b301] ring-1 ring-warning/50" />}
                {t.label}
              </span>
              <span className="text-xs font-normal text-muted">{t.status}</span>
            </LeaveStepLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
