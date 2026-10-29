"use client";

import { useEffect, useRef } from "react";

/**
 * For a row of tabs that scrolls sideways (on a phone, or with many tabs):
 * brings the open tab (aria-current="page") into view, so a tab picked off
 * the edge of the row isn't left hidden.
 */
export function useTabInView<T extends HTMLElement>(key?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const row = ref.current;
    const tab = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !tab) return;
    const left = tab.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + tab.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = Math.max(0, left - (row.clientWidth - tab.offsetWidth) / 2);
    }
  }, [key]);
  return ref;
}
