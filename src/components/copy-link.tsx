"use client";

import { toast } from "./toaster";
import { copyDialog } from "@/components/confirm-dialog";

/** Copies a link to the clipboard and says so with a toast. */
export function CopyLink({
  url,
  className,
  label = "Copy link",
  ariaLabel,
}: {
  url: string;
  className?: string;
  label?: string;
  /** The button's spoken name, when the words alone don't say whose link it is. */
  ariaLabel?: string;
}) {
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
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
