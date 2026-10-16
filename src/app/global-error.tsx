"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { brand } from "@/lib/brand";

// The last-resort error page (it replaces the whole layout, so it brings its own
// simple styles). Reports the error to Sentry when error alerts are on.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fcfbf8", color: "#0b1f33" }}>
        <title>{`Something went wrong · ${brand.name}`}</title>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: "0 16px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.6, marginTop: 12 }}>
            Please try again. If it keeps happening, email us at{" "}
            <a href={`mailto:${brand.supportEmail}`} style={{ color: "#0b3558" }}>
              {brand.supportEmail}
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 6,
              background: "#0b3558",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
