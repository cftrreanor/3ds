"use client";

import { useEffect } from "react";

/** Brings a section into view when the page opens (after publishing, the "live" box with the link to share). */
export function ScrollTo({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}
