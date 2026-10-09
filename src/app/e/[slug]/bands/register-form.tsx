"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { BandForm, type BandFormValues } from "@/components/band-form";
import { SubmitButton } from "@/components/submit-button";
import { Button, Card } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type PreviousBand = BandFormValues & { id: string; from: string };

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * New registration. Directors who've registered before see each saved band:
 * register it again in one tap, or review and edit it first.
 */
export function RegisterForm({
  action,
  again,
  classifications,
  chaperoneLimit,
  blank,
  previous,
  kind = "band",
}: {
  action: Action;
  /** One-tap registration from a saved band (bound to the event). */
  again: (sourceBandId: string, prev: ActionState, formData: FormData) => Promise<ActionState>;
  classifications: string[];
  chaperoneLimit: number;
  blank: BandFormValues;
  previous: PreviousBand[];
  kind?: "band" | "choir";
}) {
  // Which form is open: a saved band being edited, a blank one, or none yet.
  const [open, setOpen] = useState<string | null>(previous.length ? null : "new");
  const source = previous.find((p) => p.id === open);
  // Scheduling conflicts are specific to each contest, so they never carry over.
  const initial: BandFormValues = source
    ? {
        ...source,
        classification: source.classification && classifications.includes(source.classification) ? source.classification : "",
        chaperone_count: Math.min(source.chaperone_count ?? 0, chaperoneLimit),
        contest_day_conflicts: null,
      }
    : blank;

  const form = (
    <div className="space-y-3">
      {source && (
        <p className="text-sm text-muted">
          Editing {source.band_name}&apos;s saved details. Changes apply to this event only.
        </p>
      )}
      {/* Re-mount when the source changes so every box picks up the copied values. */}
      <BandForm key={open ?? ""} action={action} classifications={classifications} chaperoneLimit={chaperoneLimit} submitLabel={`Register ${kind}`} initial={initial} kind={kind} />
    </div>
  );

  if (!previous.length) return form;

  return (
    <div className="space-y-6">
      <section aria-labelledby="saved-heading" className="space-y-3">
        <h2 id="saved-heading" className="text-xl font-semibold">
          Register with your saved details
        </h2>
        {previous.map((p) => (
          <SavedBand
            kind={kind}
            key={p.id}
            band={p}
            classifications={classifications}
            chaperoneLimit={chaperoneLimit}
            register={again.bind(null, p.id)}
            editing={open === p.id}
            onEdit={() => setOpen(open === p.id ? null : p.id)}
          />
        ))}
      </section>
      {source ? (
        form
      ) : open === "new" ? (
        <section aria-labelledby="new-heading" className="space-y-3">
          <h2 id="new-heading" className="text-xl font-semibold">
            A different {kind}
          </h2>
          {form}
        </section>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setOpen("new")}>
          + Register a different {kind}
        </Button>
      )}
    </div>
  );
}

function SavedBand({
  band: b,
  classifications,
  chaperoneLimit,
  register,
  editing,
  onEdit,
  kind,
}: {
  kind: "band" | "choir";
  band: PreviousBand;
  classifications: string[];
  chaperoneLimit: number;
  register: Action;
  editing: boolean;
  onEdit: () => void;
}) {
  // Things this contest needs changed before a one-tap registration works.
  const problems = [
    b.classification && !classifications.includes(b.classification)
      ? `This event doesn't have a ${b.classification} classification. Pick one in Review & edit.`
      : null,
    (b.chaperone_count ?? 0) > chaperoneLimit ? `This event allows ${chaperoneLimit} chaperones per ${kind}.` : null,
  ].filter((x): x is string => Boolean(x));
  const vehicles = [
    [b.bus_count, "bus", "buses"],
    [b.box_truck_count, "box truck", "box trucks"],
    [b.truck_trailer_count, "truck/trailer", "truck/trailers"],
    [b.semi_truck_count, "semi", "semis"],
  ]
    .filter(([n]) => Number(n) > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(" · ");

  return (
    <Card className={editing ? "border-brand" : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-lg font-semibold">{b.band_name}</h3>
        <p className="text-sm text-muted">Saved from {b.from}</p>
      </div>
      <p className="text-muted">{b.school_name}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Detail label="Classification" value={b.classification} />
        <Detail label="People" value={`${b.student_count ?? 0} ${kind === "choir" ? "singers" : "students"} · ${b.chaperone_count ?? 0} chaperones`} />
        <Detail label="Vehicles" value={vehicles || "None"} />
        <Detail label="Head director" value={[b.head_director_name, b.head_director_phone].filter(Boolean).join(" · ")} />
        <Detail label={kind === "choir" ? "Choir contact email" : "Band contact email"} value={b.contact_email} />
        <Detail label="School address" value={b.school_address} />
      </dl>
      {problems.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-start gap-2">
        {problems.length === 0 && (
          <ActionForm action={register}>
            <SubmitButton pendingText="Registering…">Register {b.band_name}</SubmitButton>
          </ActionForm>
        )}
        <Button type="button" variant={problems.length ? "primary" : "secondary"} onClick={onEdit} aria-expanded={editing}>
          {editing ? "Close editing" : "Review & edit"}
        </Button>
      </div>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
