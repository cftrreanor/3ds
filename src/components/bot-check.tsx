"use client";

import { useEffect, useRef } from "react";

// The browser half of the bot check (lib/bot-check.ts). Cloudflare Turnstile
// adds a hidden "cf-turnstile-response" field to the form; it only shows a
// checkbox when something looks off. Renders nothing until the site key is set.

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<void> | null = null;
function loadTurnstile() {
  loading ??= new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the security check"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Put inside a public form, above its submit button. */
export function BotCheck() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!SITE_KEY || !el) return;
    let id: string | undefined;
    let gone = false;
    loadTurnstile()
      .then(() => {
        if (!gone && window.turnstile) id = window.turnstile.render(el, { sitekey: SITE_KEY, appearance: "interaction-only" });
      })
      .catch(() => {});
    // Each pass works once: after the form is sent, get a fresh one for the next try.
    const form = el.closest("form");
    const onSubmit = () => setTimeout(() => id !== undefined && window.turnstile?.reset(id), 1000);
    form?.addEventListener("submit", onSubmit);
    return () => {
      gone = true;
      form?.removeEventListener("submit", onSubmit);
      if (id !== undefined) window.turnstile?.remove(id);
    };
  }, []);
  if (!SITE_KEY) return null;
  return <div ref={ref} />;
}
