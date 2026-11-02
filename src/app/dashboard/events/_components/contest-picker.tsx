"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Field, Select } from "@/components/ui";

/**
 * "Start from a previous contest": a dropdown of the account's earlier band contests. Picking one reloads
 * the page with that contest's details filled in; "Start from scratch" clears it.
 */
export function ContestPicker({ contests, value }: { contests: { id: string; label: string }[]; value: string | null }) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  return (
    <Field label="Start from" hint={loading ? "Loading that contest…" : undefined}>
      <Select
        value={value ?? ""}
        disabled={loading}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(() => router.replace(`/dashboard/events/new?type=band_contest${id ? `&from=${id}` : ""}`, { scroll: false }));
        }}
      >
        <option value="">Start from scratch</option>
        {contests.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
