"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isMarketingPath, sourceOf, type SiteEvent } from "@/lib/site-metrics";

// Counting on the marketing pages (Admin → Site visits): a visit, each section
// reached, each button or link clicked, and starting the pilot form. Each one
// once per page per browser tab, so reloading or scrolling back doesn't add
// more. No cookies; sessionStorage stays in this tab and is never sent.

/** Where this visit came from, worked out once per tab and reused. */
function visitSource(): string {
  try {
    const saved = sessionStorage.getItem("fc_source");
    if (saved) return saved;
  } catch {
    // Storage blocked: work it out each time.
  }
  const source = sourceOf(document.referrer, window.location.search, window.location.hostname);
  try {
    sessionStorage.setItem("fc_source", source);
  } catch {
    // Storage blocked: fine.
  }
  return source;
}

/** True the first time this key is seen in this tab. */
function firstTime(key: string) {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: count it anyway.
  }
  return true;
}

/** Counts one thing on this marketing page, once per tab. Never throws. */
export function countSiteEvent(event: Exclude<SiteEvent, "pilot_sent">, label = "") {
  try {
    const path = window.location.pathname;
    if (!isMarketingPath(path) || navigator.webdriver || window.self !== window.top) return;
    if (!firstTime(`fc_${event}:${path}:${label}`)) return;
    const body = JSON.stringify({ event, path, source: visitSource(), label });
    const sent = navigator.sendBeacon?.("/api/site-metrics", new Blob([body], { type: "application/json" }));
    if (!sent) fetch("/api/site-metrics", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    // Counting never gets in the way.
  }
}

/** The pilot form passes the visit's source along with a request. */
export const pilotSource = () => {
  try {
    return visitSource();
  } catch {
    return "";
  }
};

const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/[→←]/g, "").replace(/\s+/g, " ").trim();

/** A section's name: data-section if set, "Top of page" for the one with the page title, else its heading. */
function sectionName(section: Element): string {
  const named = (section as HTMLElement).dataset.section;
  if (named) return named;
  if (section.querySelector("h1")) return "Top of page";
  return text(section.querySelector("h2, h3")).slice(0, 60);
}

/** A click's name: data-track if set, else where it is (header, a section, footer) and what it says. */
function clickName(el: HTMLElement): string {
  const named = el.closest<HTMLElement>("[data-track]")?.dataset.track;
  if (named) return named;
  // A card's first line of text (its title), not everything in it run together.
  const firstLine = (el.innerText || el.textContent || "")
    .split("\n")
    .map((l) => l.replace(/[→←]/g, "").trim())
    .find((l) => /[A-Za-z0-9]/.test(l));
  const words = (el.getAttribute("aria-label") || firstLine || "").slice(0, 50);
  if (!words) return "";
  const section = el.closest("main section");
  const where = el.closest("header") ? "Header" : el.closest("footer") ? "Footer" : section ? sectionName(section) || "Page" : "Page";
  return `${where}: ${words}`;
}

/** Counts visits, sections reached, and clicks on the marketing pages (in the root layout). */
export function SiteMetrics() {
  const pathname = usePathname();
  useEffect(() => {
    if (!isMarketingPath(pathname)) return;
    countSiteEvent("view");

    // A section counts once it has been in the upper 60% of the screen for a
    // second, so jumping past it (the FAQ link in the header) doesn't count it.
    const sections = [...document.querySelectorAll("main section")].filter((s) => sectionName(s));
    const timers = new Map<Element, number>();
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          window.clearTimeout(timers.get(e.target));
          if (!e.isIntersecting) continue;
          timers.set(
            e.target,
            window.setTimeout(() => {
              countSiteEvent("section", sectionName(e.target));
              seen.unobserve(e.target);
            }, 1000),
          );
        }
      },
      { rootMargin: "0px 0px -40% 0px" },
    );
    sections.forEach((s) => seen.observe(s));

    // Buttons and links, not form fields (the pilot form counts itself) or our QA controls.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("a, button");
      if (!el || el.closest("form, [data-qa-ui]")) return;
      const name = clickName(el);
      if (name) countSiteEvent("click", name);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      seen.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname]);
  return null;
}
