"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/pilot-requests", label: "Pilot requests" },
  { href: "/admin/activity", label: "Admin activity" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="mt-2 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((t) => {
        const current = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={current ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${
              current ? "border-brand text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
