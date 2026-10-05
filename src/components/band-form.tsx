"use client";

import { ActionForm } from "@/components/action-form";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export type BandFormValues = Partial<{
  school_name: string;
  band_name: string;
  classification: string;
  school_address: string;
  contact_email: string;
  head_director_name: string;
  head_director_email: string;
  head_director_phone: string;
  assistant_directors: string[];
  student_count: number;
  chaperone_count: number;
  bus_count: number;
  box_truck_count: number;
  truck_trailer_count: number;
  semi_truck_count: number;
  contest_day_conflicts: string | null;
  special_needs: string | null;
}>;

/** The band registration form, used to register and to edit. */
export function BandForm({
  action,
  classifications,
  chaperoneLimit,
  initial = {},
  submitLabel,
  disabled = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  classifications: string[];
  chaperoneLimit: number;
  initial?: BandFormValues;
  submitLabel: string;
  disabled?: boolean;
}) {
  const num = (v: number | undefined) => (v === undefined ? "" : String(v));
  return (
    <ActionForm action={action} className="space-y-6" resetOnSuccess={false}>
      <fieldset disabled={disabled} className="space-y-6">
        <Card className="space-y-4">
          <h2 className="font-semibold">School &amp; ensemble</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="School name">
              <Input name="schoolName" required defaultValue={initial.school_name} placeholder="e.g. Cedar Ridge High School" />
            </Field>
            <Field label="Band name">
              <Input name="bandName" required defaultValue={initial.band_name} placeholder="e.g. Raider Regiment" />
            </Field>
            <Field label="Classification">
              <Select name="classification" required defaultValue={initial.classification ?? ""}>
                <option value="" disabled>
                  Choose…
                </option>
                {classifications.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Band contact email" hint="Where the host should send updates.">
              <Input name="contactEmail" type="email" required defaultValue={initial.contact_email} />
            </Field>
            <Field label="School address" className="sm:col-span-2">
              <Input name="schoolAddress" required defaultValue={initial.school_address} autoComplete="street-address" />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Directors</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Head director's name">
              <Input name="headDirectorName" required defaultValue={initial.head_director_name} autoComplete="name" />
            </Field>
            <Field label="Head director's mobile">
              <Input name="headDirectorPhone" type="tel" inputMode="tel" required defaultValue={initial.head_director_phone} />
            </Field>
            <Field label="Head director's email" className="sm:col-span-2">
              <Input name="headDirectorEmail" type="email" required defaultValue={initial.head_director_email} />
            </Field>
            <Field label="Assistant directors" hint="Optional. One per line." className="sm:col-span-2">
              <Textarea name="assistantDirectors" defaultValue={(initial.assistant_directors ?? []).join("\n")} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Who&apos;s coming</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Student performers">
              <NumberInput name="studentCount" required defaultValue={num(initial.student_count)} />
            </Field>
            <Field label="Chaperones" hint={`Up to ${chaperoneLimit} for this event.`}>
              <NumberInput
                name="chaperoneCount"
                required
                defaultValue={num(initial.chaperone_count)}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">Vehicles</h2>
            <p className="mt-1 text-sm text-muted">Helps the parking crew plan space for you.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Buses">
              <NumberInput name="busCount" defaultValue={num(initial.bus_count ?? 0)} />
            </Field>
            <Field label="Box trucks">
              <NumberInput name="boxTruckCount" defaultValue={num(initial.box_truck_count ?? 0)} />
            </Field>
            <Field label="Truck + trailer">
              <NumberInput name="truckTrailerCount" defaultValue={num(initial.truck_trailer_count ?? 0)} />
            </Field>
            <Field label="Semi trucks (18-wheelers)">
              <NumberInput name="semiTruckCount" defaultValue={num(initial.semi_truck_count ?? 0)} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold">Contest day</h2>
          <Field
            label="Scheduling conflicts"
            hint="Optional. E.g. ACT testing until noon, cross country meet, homecoming that night."
          >
            <Textarea name="contestDayConflicts" defaultValue={initial.contest_day_conflicts ?? ""} />
          </Field>
          <Field label="Accessibility or staging needs" hint="Optional. ADA needs, pit equipment, power, anything we should know.">
            <Textarea name="specialNeeds" defaultValue={initial.special_needs ?? ""} />
          </Field>
        </Card>
      </fieldset>

      {!disabled && <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>}
    </ActionForm>
  );
}
