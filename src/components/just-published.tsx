"use client";

import { useEffect } from "react";
import { toast } from "./toaster";

/**
 * Right after publishing (?published=1): say so once, start at the top of the
 * page so the links to share are in view, and take ?published=1 off the
 * address so a refresh or a later visit doesn't say it again.
 */
export function JustPublished() {
  useEffect(() => {
    toast("Your event is now public.");
    window.scrollTo({ top: 0 });
    const url = new URL(window.location.href);
    url.searchParams.delete("published");
    window.history.replaceState(null, "", url);
  }, []);
  return null;
}
