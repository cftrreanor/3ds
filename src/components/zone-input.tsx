"use client";

import { useRef } from "react";
import { Input } from "./ui";

/**
 * A fair's zone field: type any zone name (e.g. "Bounce Houses"), or tap one
 * of the suggestions underneath (the usual five plus the zones this event
 * already uses) to fill it in.
 */
export function ZoneInput({ zones, defaultValue }: { zones: readonly string[]; defaultValue?: string | null }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Input ref={ref} name="zone" maxLength={60} defaultValue={defaultValue ?? ""} placeholder="Type a zone, or pick one below" />
      <div className="flex flex-wrap gap-1.5" aria-label="Zone suggestions">
        {zones.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => {
              if (!ref.current) return;
              ref.current.value = z;
              ref.current.focus();
            }}
            className="min-h-8 rounded-full border border-border bg-surface px-3 text-sm hover:border-brand hover:text-brand"
          >
            {z}
          </button>
        ))}
      </div>
    </div>
  );
}
