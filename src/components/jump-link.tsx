"use client";

import type { ComponentProps } from "react";

/**
 * A link to a section further down the same page ("#join"). Browsers scroll
 * there but leave keyboard and screen-reader position where it was, so this
 * also moves focus to the section (which needs tabIndex={-1}).
 */
export function JumpLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: `#${string}` }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        // After the browser has scrolled.
        requestAnimationFrame(() => document.getElementById(href.slice(1))?.focus({ preventScroll: true }));
      }}
      {...props}
    />
  );
}
