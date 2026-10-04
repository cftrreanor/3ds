"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the page every so often (while visible) so the schedule stays live. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
