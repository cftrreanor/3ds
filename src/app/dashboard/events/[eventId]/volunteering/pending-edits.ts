"use client";

import { useCallback, useEffect, useId, useSyncExternalStore } from "react";

/**
 * Everything on a job's page that isn't saved yet, outside the job's own form: a thing to bring
 * saving itself ("saving", or "failed"), and a shift or thing to bring typed in but not added
 * ("unadded"). The job's pinned bar reads it to say what's not saved, and to wait or ask before leaving.
 */
type Entry = { kind: "saving" | "failed" | "unadded"; flush?: () => void };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;

export function setPending(key: string, entry: Entry | null) {
  if (entry) entries.set(key, entry);
  else if (!entries.delete(key)) return;
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function pendingCounts() {
  const counts = { saving: 0, failed: 0, unadded: 0 };
  entries.forEach((e) => counts[e.kind]++);
  return counts;
}

/** The counts, kept up to date. */
export function usePendingCounts() {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return pendingCounts();
}

/** Saves whatever is waiting to save itself, now. */
export function flushPending() {
  entries.forEach((e) => e.flush?.());
}

/** Resolves true once nothing is saving, false if a save fails or it takes too long. */
export function settled(timeoutMs = 8000) {
  return new Promise<boolean>((resolve) => {
    const check = () => {
      const c = pendingCounts();
      if (c.failed) return finish(false);
      if (!c.saving) return finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const stop = subscribe(check);
    function finish(ok: boolean) {
      clearTimeout(timer);
      stop();
      resolve(ok);
    }
    check();
  });
}

/** Whether a form's boxes differ from what it started with (hidden fields don't count). */
export function formChanged(form: HTMLFormElement) {
  return [...form.elements].some((el) => {
    if (el instanceof HTMLInputElement) {
      if (el.type === "hidden" || el.type === "submit" || el.type === "button") return false;
      if (el.type === "checkbox" || el.type === "radio") return el.checked !== el.defaultChecked;
      return el.value !== el.defaultValue;
    }
    if (el instanceof HTMLTextAreaElement) return el.value !== el.defaultValue;
    if (el instanceof HTMLSelectElement) return [...el.options].some((o) => o.selected !== o.defaultSelected);
    return false;
  });
}

/** For a form that adds or edits with its own button: notes when something's typed in but not saved. */
export function useUnadded() {
  const key = useId();
  useEffect(() => () => setPending(key, null), [key]);
  return useCallback((form: HTMLFormElement) => setPending(key, formChanged(form) ? { kind: "unadded" } : null), [key]);
}
