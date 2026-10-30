"use client";

import { toast } from "./toaster";
import { copyDialog } from "@/components/confirm-dialog";

/** Copies text to the clipboard and says so with a toast (or shows it to copy by hand). */
async function copy(text: string, title: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    await copyDialog(title, text);
  }
}

/** Copies a link to the clipboard and says so with a toast. `onCopy` records it (ticks Next steps). */
export function CopyLink({ url, className, onCopy }: { url: string; className?: string; onCopy?: () => Promise<unknown> }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await copy(url, "Copy this link", "Link copied.");
        void onCopy?.();
      }}
      className={className}
    >
      Copy link
    </button>
  );
}

/** Downloads a link's QR code; `onDownload` records it (ticks Next steps). */
export function QrDownload({ href, fileName, className, onDownload }: { href: string; fileName: string; className?: string; onDownload?: () => Promise<unknown> }) {
  return (
    <a href={href} download={fileName} onClick={() => void onDownload?.()} className={className}>
      QR code
    </a>
  );
}

/** The event's details for a flyer or newsletter: copy them, or see them first. */
export function CopyAnnouncement({ text, className, onCopy }: { text: string; className?: string; onCopy?: () => Promise<unknown> }) {
  return (
    <span className="flex shrink-0 gap-x-4 whitespace-nowrap">
      <button
        type="button"
        onClick={async () => {
          await copy(text, "Copy the announcement", "Announcement copied. Paste it into your flyer, newsletter, or post.");
          void onCopy?.();
        }}
        className={className}
      >
        Copy announcement
      </button>
      <button
        type="button"
        // Just looking doesn't tick the step (Copy announcement, or Mark as done, does).
        onClick={() => void copyDialog("Your announcement", text)}
        className={className}
      >
        See it
      </button>
    </span>
  );
}
