"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; count?: number; alert?: boolean };

/** The admin sidebar's links (a scrolling row on phones). */
export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-0.5 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((t) => {
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
    </nav>
  );
}
