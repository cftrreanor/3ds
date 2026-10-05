"use client";

import { useState } from "react";
import { BandForm, type BandFormValues } from "@/components/band-form";
import { Card, Field, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type PreviousBand = BandFormValues & { id: string; label: string };

/**
 * New registration, optionally started from one of the director's earlier
 * registrations so they don't retype the same school, people and vehicles.
 */
export function RegisterForm({
  action,
  classifications,
  chaperoneLimit,
  blank,
  previous,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  classifications: string[];
  chaperoneLimit: number;
  blank: BandFormValues;
  previous: PreviousBand[];
}) {
  const [sourceId, setSourceId] = useState("");
  const source = previous.find((p) => p.id === sourceId);
  // Scheduling conflicts are specific to each contest, so they never carry over.
  const initial: BandFormValues = source
    ? {
        ...source,
        classification: source.classification && classifications.includes(source.classification) ? source.classification : "",
        chaperone_count: Math.min(source.chaperone_count ?? 0, chaperoneLimit),
        contest_day_conflicts: null,
      }
    : blank;

  return (
    <div className="space-y-6">
      {previous.length > 0 && (
        <Card className="bg-accent-soft">
          <Field label="Start from a previous registration" hint="Copies everything except scheduling conflicts. Check the numbers before you submit.">
            <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Start from scratch</option>
              {previous.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        </Card>
      )}
      {/* Re-mount when the source changes so every box picks up the copied values. */}
      <BandForm key={sourceId} action={action} classifications={classifications} chaperoneLimit={chaperoneLimit} submitLabel="Register band" initial={initial} />
    </div>
  );
}
