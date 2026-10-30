"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { brand } from "@/lib/brand";

/**
 * What a page shows when something on it breaks. It replaces just that page, so
 * the header (and, on event day, the tab bar) stays and people can move on.
 */
export function ErrorPanel({
  error,
  retry,
  back,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  back?: { href: string; label: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto w-full max-w-xl py-10">
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">This page didn&apos;t load</h1>
      <p className="mt-3 leading-7 text-muted">
        Something went wrong on our side, or the connection dropped. Nothing you saved has been lost. Try again, and if it keeps
        happening, email us at <span className="font-medium text-foreground select-all">{brand.supportEmail}</span>
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
        {back && (
          <Link
            href={back.href}
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:border-brand/40"
          >
            {back.label}
          </Link>
        )}
      </div>
    </div>
  );
}
