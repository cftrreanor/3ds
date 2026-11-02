"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; count?: number; alert?: boolean };

export type NavGroup = { title?: string; items: NavItem[] };

/** The admin sidebar's links, in titled groups (one scrolling row on phones, with a divider between groups). */
export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-0.5 overflow-x-auto sm:flex-wrap sm:gap-y-1 sm:overflow-visible lg:flex-col lg:flex-nowrap lg:gap-5">
      {groups.map((g, i) => (
        <div key={g.title ?? i} className={`flex shrink-0 gap-0.5 lg:flex-col ${i > 0 ? "border-l border-white/10 pl-1 lg:border-0 lg:pl-0" : ""}`}>
          {g.title && <p className="hidden px-2.5 pb-1 text-xs font-semibold tracking-wide text-on-dark-mute uppercase lg:block">{g.title}</p>}
          {g.items.map((t) => {
            const current = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={current ? "page" : undefined}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-sm ${
                  current ? "bg-white/12 font-semibold text-white" : "text-on-dark-mute hover:bg-white/6 hover:text-white"
                }`}
              >
                {t.label}
                {t.count ? (
                  <span
                    className={`rounded-sm px-1.5 text-xs font-semibold tabular-nums ${
                      t.alert ? "bg-violet text-header" : "bg-white/10 text-white"
                    }`}
                  >
                    {t.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
