"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/** Opens the browser's print window, where "Save as PDF" is one of the printers. */
export function PrintBadgesButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
    >
      Print or save as PDF
    </button>
  );
}

// The badge band when there's no logo (fixed, so dark mode can't change what prints).
const NAVY = "#0b3558";

/**
 * The badges, with the VOLUNTEER band in the logo's main color. Black or
 * near-white logos and pale colors are darkened until white text on the band
 * is easy to read.
 */
export function BadgeColorScope({ logo, className, children }: { logo: string | null; className?: string; children: ReactNode }) {
  const [found, setFound] = useState<{ logo: string; color: string } | null>(null);
  const color = logo && found?.logo === logo ? found.color : NAVY;
  useEffect(() => {
    if (!logo) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live) setFound({ logo, color: logoColor(img) ?? NAVY });
    };
    img.src = logo;
    return () => {
      live = false;
    };
  }, [logo]);
  return (
    <div className={className} style={{ "--badge-band": color } as CSSProperties}>
      {children}
    </div>
  );
}

/** The logo's main color: the most common one, favoring colorful over gray, ignoring see-through and white. */
function logoColor(img: HTMLImageElement): string | null {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, { r: number; g: number; b: number; n: number; weight: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128 || (r > 230 && g > 230 && b > 230)) continue;
    const max = Math.max(r, g, b);
    const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const s = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, weight: 0 };
    s.r += r;
    s.g += g;
    s.b += b;
    s.n += 1;
    s.weight += 1 + saturation * 3;
    buckets.set(key, s);
  }
  let best: { r: number; g: number; b: number; n: number; weight: number } | null = null;
  for (const s of buckets.values()) if (!best || s.weight > best.weight) best = s;
  if (!best) return null;
  let [r, g, b] = [best.r / best.n, best.g / best.n, best.b / best.n];
  // Darken until white text has at least 4.5:1 contrast (the accessibility standard).
  while (contrastWithWhite(r, g, b) < 4.5) [r, g, b] = [r * 0.9, g * 0.9, b * 0.9];
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function contrastWithWhite(r: number, g: number, b: number) {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (l + 0.05);
}
