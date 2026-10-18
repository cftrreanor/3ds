"use client";

import { useEffect, useState } from "react";

// One rendering per page, shared by every badge's back.
const cache = new Map<string, Promise<{ src: string; landscape: boolean }>>();

async function imageSize(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return { src, landscape: img.naturalWidth > img.naturalHeight };
}

/** A PDF's first page, drawn as an image (so it prints like a photo). */
async function pdfFirstPage(url: string) {
  // The "legacy" build runs in older browsers too (school computers are often a few versions behind).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ url }).promise;
  const page = await doc.getPage(1);
  // About 300 dots per inch across a 6-inch badge.
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1800 / Math.max(base.width, base.height) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return { src: canvas.toDataURL("image/png"), landscape: canvas.width > canvas.height };
}

function load(url: string, pdf: boolean) {
  const key = `${pdf}:${url}`;
  if (!cache.has(key)) cache.set(key, pdf ? pdfFirstPage(url) : imageSize(url));
  return cache.get(key)!;
}

/**
 * The map on the back of a badge: a photo, or a PDF's first page. Turned
 * sideways when it's wider than tall, so it fills the 4 × 6 card.
 */
export function MapBack({ url, pdf, label }: { url: string; pdf: boolean; label: string }) {
  const [map, setMap] = useState<{ src: string; landscape: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    load(url, pdf).then(
      (m) => live && setMap(m),
      (e) => {
        console.error("Badge map didn't load", e);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [url, pdf]);

  if (failed) return <p className="p-4 text-center text-sm text-muted">We couldn&apos;t open {label}. Try a JPG or PNG copy of the map.</p>;
  if (!map) return <p className="p-4 text-center text-sm text-muted">Loading {label}…</p>;
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={map.src} alt={label} className="h-full w-full object-contain" />;
  if (!map.landscape) return <div className="absolute inset-[0.15in]">{img}</div>;
  return (
    <div className="absolute top-1/2 left-1/2 h-[3.7in] w-[5.7in] -translate-x-1/2 -translate-y-1/2 rotate-90">{img}</div>
  );
}
