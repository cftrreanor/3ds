"use client";

import { toast } from "./toaster";

/** Copies a link to the clipboard and says so with a toast. */
export function CopyLink({ url, className }: { url: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast("Link copied.");
        } catch {
          window.prompt("Copy this link:", url);
        }
      }}
      className={className}
    >
      Copy link
    </button>
  );
}
