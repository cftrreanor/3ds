"use client";

import { toast } from "./toaster";
import { copyDialog } from "@/components/confirm-dialog";

/** Copies a link to the clipboard and says so with a toast. */
export function CopyLink({ url, className, label = "Copy link" }: { url: string; className?: string; label?: string }) {
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
      {label}
    </button>
  );
}
