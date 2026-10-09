"use client";

import type { ReactNode } from "react";
import { CONTEST_INFO_COOKIE } from "@/lib/preferences";

/** Contest info & contact: starts the way the director last left it on this device. */
export function CollapsibleInfo({
  initialOpen,
  label = "Contest info",
  children,
}: {
  initialOpen: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <details
      open={initialOpen}
      className="group mt-3"
      onToggle={(e) => {
        document.cookie = `${CONTEST_INFO_COOKIE}=${e.currentTarget.open ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand [&::-webkit-details-marker]:hidden">
        {label} &amp; contact
        <span aria-hidden="true" className="text-muted transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      {children}
    </details>
  );
}
