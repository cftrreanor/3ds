"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { confirmDialog } from "@/components/confirm-dialog";

/**
 * Everything on a page that isn't saved yet (a volunteer job's page, band registration): a thing to bring
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

/**
 * While anything on the page isn't saved: closing the tab asks first, switching apps saves at once,
 * and a link to another page waits for pending saves, then goes. If a save failed, or something is
 * typed but not added, it asks first, naming what would be lost.
 */
export function useLeaveGuard(what = "A change") {
  const router = useRouter();
  const counts = usePendingCounts();
  const unsaved = counts.saving + counts.failed + counts.unadded > 0;
  const leaving = useRef(false);

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flushPending);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flushPending);
    };
  }, []);

  useEffect(() => {
    const guard = (e: MouseEvent) => {
      const c = pendingCounts();
      if (!c.saving && !c.failed && !c.unadded) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/")) return;
      e.preventDefault();
      e.stopPropagation();
      if (leaving.current) return;
      leaving.current = true;
      void (async () => {
        flushPending();
        const saved = await settled();
        const go =
          (saved && !pendingCounts().unadded) ||
          (await confirmDialog(
            saved
              ? { title: "Leave without adding it?", message: "Something you typed isn't added yet.", confirmLabel: "Leave anyway", cancelLabel: "Stay here" }
              : { title: "Leave before it saves?", message: `${what} isn't saved.`, confirmLabel: "Leave anyway", cancelLabel: "Stay here" },
          ));
        leaving.current = false;
        if (go) router.push(href, { scroll: new URL(href, location.href).pathname !== location.pathname });
      })();
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [router, what]);

  return counts;
}
