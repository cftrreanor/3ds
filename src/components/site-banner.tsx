"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import type { BannerTone, SiteBanner } from "@/lib/banner-types";

const TONE: Record<BannerTone, { box: string; label: string }> = {
  info: { box: "border-brand/25 bg-brand-soft", label: "Update" },
  success: { box: "border-success/30 bg-success-soft", label: "New" },
  warning: { box: "border-warning/30 bg-warning-soft", label: "Heads up" },
  urgent: { box: "border-danger/40 bg-danger/10", label: "Urgent" },
};

/** One company banner. Pass `onDismiss` to show the close button (never for urgent ones). */
export function SiteBannerView({
  banner,
  onDismiss,
}: {
  banner: Pick<SiteBanner, "title" | "body" | "link_label" | "link_url" | "tone">;
  onDismiss?: () => Promise<void> | void;
}) {
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;
  const t = TONE[banner.tone] ?? TONE.info;
  const canClose = onDismiss && banner.tone !== "urgent";
  return (
    <div role={banner.tone === "urgent" ? "alert" : "status"} className={`flex items-start gap-3 rounded-md border px-4 py-3 ${t.box}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className={`mr-2 text-xs font-bold tracking-wide uppercase ${banner.tone === "urgent" ? "text-danger" : "text-muted"}`}>{t.label}</span>
          <span className="font-semibold">{banner.title}</span>
        </p>
        {banner.body && <p className="mt-0.5 text-sm whitespace-pre-line">{banner.body}</p>}
        {banner.link_url && (
          <a href={banner.link_url} className="mt-1 inline-block text-sm font-semibold text-brand underline underline-offset-4">
            {banner.link_label || "Learn more"} →
          </a>
        )}
      </div>
      {canClose && (
        <button
          type="button"
          aria-label="Close this message"
          disabled={pending}
          onClick={() => {
            setHidden(true);
            start(async () => {
              await onDismiss();
            });
          }}
          className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-md text-lg leading-none text-muted hover:bg-black/5 hover:text-foreground"
        >
          ×
        </button>
      )}
    </div>
  );
}

const CLOSED_KEY = "fc-closed-banners";
const readClosed = () => {
  try {
    return localStorage.getItem(CLOSED_KEY) ?? "[]";
  } catch {
    return "[]";
  }
};
const noSubscribe = () => () => {};

/** Public banners for signed-out visitors: closing one is remembered in this browser. */
export function PublicBanners({ banners }: { banners: SiteBanner[] }) {
  // The server (and first paint) shows them all; the browser then hides the closed ones.
  const closedRaw = useSyncExternalStore(noSubscribe, readClosed, () => "[]");
  let closed: string[] = [];
  try {
    closed = JSON.parse(closedRaw) as string[];
  } catch {
    closed = [];
  }
  const visible = banners.filter((b) => b.tone === "urgent" || !closed.includes(b.id));
  if (visible.length === 0) return null;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-2 px-4 pt-4 sm:px-6">
      {visible.map((b) => (
        <SiteBannerView
          key={b.id}
          banner={b}
          onDismiss={() => {
            try {
              const list = JSON.parse(readClosed()) as string[];
              localStorage.setItem(CLOSED_KEY, JSON.stringify([...new Set([...list, b.id])].slice(-50)));
            } catch {
              // Private browsing: it just shows again next time.
            }
          }}
        />
      ))}
    </div>
  );
}
