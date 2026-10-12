"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A row of cards that scrolls sideways: swipe on a phone, or use the arrow
 * buttons (or a trackpad) on a computer. Each card snaps into place, and the
 * next one peeks in from the edge so it's clear there's more.
 * Children are the cards' <li>s; give each a width and `shrink-0 snap-start`.
 */
export function CardCarousel({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  // One card (plus the gap) at a time.
  const step = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  };

  const arrow =
    "flex size-11 items-center justify-center rounded-full border border-border bg-surface text-lg transition hover:border-brand hover:text-brand disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-current";

  return (
    <div className="mt-10">
      <div className="mb-4 flex justify-end gap-2">
        <button type="button" className={arrow} onClick={() => step(-1)} disabled={atStart} aria-label="Previous event types">
          <span aria-hidden>←</span>
        </button>
        <button type="button" className={arrow} onClick={() => step(1)} disabled={atEnd} aria-label="Next event types">
          <span aria-hidden>→</span>
        </button>
      </div>
      <ul
        ref={track}
        onScroll={update}
        tabIndex={0}
        aria-label={label}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-6 sm:px-6"
      >
        {children}
      </ul>
    </div>
  );
}
