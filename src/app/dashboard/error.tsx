"use client";

import { ErrorPanel } from "@/components/error-panel";

// Any organizer page that breaks: the header stays, so people can move on.
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} back={{ href: "/dashboard", label: "My events" }} />;
}
