"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// A card whose body opens and closes with a button, and remembers that
// choice in this browser (so a host who closes it keeps it closed on every
// event). The header row always shows.

const KEY = "fc-panels";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

function save(id: string, open: boolean) {
  try {
    const all = JSON.parse(read() ?? "{}") as Record<string, boolean>;
    localStorage.setItem(KEY, JSON.stringify({ ...all, [id]: open }));
  } catch {
    // Private browsing: it just won't be remembered.
  }
  listeners.forEach((fn) => fn());
}

export function RememberedPanel({
  id,
  header,
  showLabel,
  hideLabel,
  defaultOpen = true,
  className = "",
  children,
}: {
  /** Which panel this is; the same id shares one remembered choice across pages. */
  id: string;
  header: ReactNode;
  showLabel: string;
  hideLabel: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  let open = defaultOpen;
  try {
    const value = (JSON.parse(stored ?? "{}") as Record<string, boolean>)[id];
    if (typeof value === "boolean") open = value;
  } catch {
    // Ignore a damaged value.
  }
  const bodyId = `panel-${id}`;
  return (
    <div className={`rounded-lg border border-border bg-surface p-4 shadow-card sm:px-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">{header}</div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => save(id, !open)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-background"
        >
          {open ? hideLabel : showLabel}
          <span aria-hidden className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
      </div>
      <div id={bodyId} hidden={!open} className="mt-4 border-t border-border pt-4">
        {children}
      </div>
    </div>
  );
}
