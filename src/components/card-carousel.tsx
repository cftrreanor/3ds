"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A row of cards that scrolls sideways: swipe on a phone, or use the arrow
 * buttons (or a trackpad) on a computer. Each card snaps into place, and the
 * next one peeks in from the edge so it's clear there's more.
 * Children are the cards' <li>s; give each a width and `shrink-0 snap-start`.
 * When every card already fits (a wide screen), the arrows are hidden.
 */
export function CardCarousel({
  label,
  itemName,
  ordered = false,
  grid = false,
  children,
}: {
  label: string;
  /** What the cards are, for the arrows' labels: "Next event types". */
  itemName: string;
  /** A numbered list (steps) instead of a plain one. */
  ordered?: boolean;
  /** On wide screens, show every card in a grid instead of a row (cards add `lg:w-auto`). */
  grid?: boolean;
  children: ReactNode;
}) {
  const track = useRef<HTMLUListElement & HTMLOListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [scrolls, setScrolls] = useState(true);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    setScrolls(el.scrollWidth > el.clientWidth + 4);
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

  const List = ordered ? "ol" : "ul";
  const arrow =
    "flex size-11 items-center justify-center rounded-full border border-border bg-surface text-lg transition hover:border-brand hover:text-brand disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-current";

  return (
    <div className="mt-6">
      <List
        ref={track}
        onScroll={update}
        tabIndex={0}
        aria-label={label}
        className={`no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-5 sm:-mx-6 sm:scroll-px-6 sm:gap-6 sm:px-6 ${
          grid ? "lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:overflow-visible lg:px-0" : ""
        }`}
      >
        {children}
      </List>
      <div className={`mt-4 justify-center gap-2 ${scrolls ? "flex" : "hidden"}`}>
        <button type="button" className={arrow} onClick={() => step(-1)} disabled={atStart} aria-label={`Previous ${itemName}`}>
          <span aria-hidden>←</span>
        </button>
        <button type="button" className={arrow} onClick={() => step(1)} disabled={atEnd} aria-label={`Next ${itemName}`}>
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
