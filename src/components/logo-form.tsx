"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { prepareLogoUpload, saveLogo } from "@/app/dashboard/logo-actions";
import { Button } from "@/components/ui";
import { uploadToSignedUrl } from "@/lib/signed-upload";

const TYPES = ["image/png", "image/jpeg"];
const MAX = 2 * 1024 * 1024;

/** The account's logo (one for every event): upload, replace, or remove. Hosts only. */
export function LogoForm({ eventId, logo }: { eventId: string; logo: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!TYPES.includes(file.type)) return setError("Please choose a PNG or JPG image.");
    if (file.size > MAX) return setError("That image is over 2 MB. Try a smaller one.");
    setBusy("Uploading…");
    const ticket = await prepareLogoUpload(eventId, { contentType: file.type, size: file.size });
    if (ticket.error || !ticket.path || !ticket.url) {
      setBusy(null);
      return setError(ticket.error ?? "We couldn't start the upload. Please try again.");
    }
    if (!(await uploadToSignedUrl(ticket.url, file))) {
      setBusy(null);
      return setError("The upload didn't go through. Check your connection and try again.");
    }
    setBusy("Saving…");
    const saved = await saveLogo(eventId, ticket.path);
    setBusy(null);
    if (saved.error) return setError(saved.error);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Remove the logo? Badges for all your events will show the event name instead.")) return;
    setError(null);
    setBusy("Removing…");
    const saved = await saveLogo(eventId, null);
    setBusy(null);
    if (saved.error) return setError(saved.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-16 w-32 items-center justify-center rounded-md border border-border bg-white p-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Your logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted">No logo yet</span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label="Choose a logo image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button type="button" variant="secondary" disabled={!!busy} onClick={() => input.current?.click()}>
            {logo ? "Replace logo" : "Upload logo"}
          </Button>
          {logo && (
            <Button type="button" variant="ghost" disabled={!!busy} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {busy ?? "PNG or JPG, up to 2 MB. Used on badges for all your events."}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
