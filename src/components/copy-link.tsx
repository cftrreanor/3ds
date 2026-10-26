"use client";

import { toast } from "./toaster";
import { copyDialog } from "@/components/confirm-dialog";

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
          await copyDialog("Copy this link", url);
        }
      }}
      className={className}
    >
      Copy link
    </button>
  );
}
