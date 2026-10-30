"use client";

import { ErrorPanel } from "@/components/error-panel";

// A public event page that breaks: the footer stays, and the page offers a retry.
export default function EventPageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="w-full flex-1 px-4">
      <ErrorPanel error={error} retry={retry} />
    </main>
  );
}
