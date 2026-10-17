"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { BotCheck } from "@/components/bot-check";
import { SubmitButton } from "@/components/submit-button";
import { Button, Card, Field, FormMessage, Input, Textarea } from "@/components/ui";
import type { BookingState } from "./actions";

type Parent = { name: string; email: string; phone: string };
const blankParent = (): Parent => ({ name: "", email: "", phone: "" });

/** One open meeting time: its value (an ISO instant) and how it reads ("3:20 PM"). */
export type OpenTime = { value: string; label: string };

/**
 * A family books a meeting: pick an open time, their child, the parents who'll
 * come (each is emailed), in person or video when it's their choice, and an
 * optional note. Booked times never show.
 */
export function BookingForm({
  action,
  times,
  askMode,
  zone,
}: {
  action: (prev: BookingState, formData: FormData) => Promise<BookingState>;
  times: OpenTime[];
  /** Parent's choice: ask in person or video. */
  askMode: boolean;
  /** The conference's time zone by name, e.g. "Central Time". */
  zone: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, {});
  const [startedAt] = useState(() => Date.now());
  const [time, setTime] = useState(state.values?.startsAt ?? "");
  const [parents, setParents] = useState<Parent[]>(() => state.values?.parents ?? [blankParent()]);
  const set = (i: number, patch: Partial<Parent>) => setParents((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  // Someone took the time first: fetch the times that are still open. The
  // taken one drops out of the list, which clears the pick.
  useEffect(() => {
    if (state.taken) router.refresh();
  }, [state, router]);
  const picked = times.some((t) => t.value === time) ? time : "";

  if (state.booked) {
    const b = state.booked;
    return (
      <Card className="space-y-3 border-success/30 bg-success-soft" role="status">
        <h2 className="text-2xl font-semibold">You&apos;re booked</h2>
        <p className="text-lg font-medium">{b.when}</p>
        <p>Conference for {b.child}.</p>
        <p className="text-sm text-muted">
          {b.emailSent
            ? `We emailed a calendar invite to ${b.emails.join(" and ")}, with the details and a link to change or cancel. We'll remind you the day before.`
            : "We couldn't send every confirmation email, but your time is booked. Save the link below to change or cancel."}
        </p>
        <a href={b.link} className="font-medium text-brand underline underline-offset-4">
          See, change, or cancel this booking
        </a>
      </Card>
    );
  }

  if (!times.length) {
    return (
      <Card>
        <p className="font-medium">Every time is booked.</p>
        <p className="mt-1 text-sm text-muted">Please contact your child&apos;s teacher to find another time.</p>
      </Card>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="startedAt" value={startedAt} />
      <input type="hidden" name="startsAt" value={picked} />
      <input type="hidden" name="parents" value={JSON.stringify(parents)} />
      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className="text-lg font-semibold">Pick a time</legend>
        <p className="text-sm text-muted">Only open times are shown. All times are {zone}.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {times.map((t) => (
            <label
              key={t.value}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold tabular-nums has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                picked === t.value ? "border-brand bg-brand text-brand-foreground" : "border-field-border hover:border-brand"
              }`}
            >
              <input
                type="radio"
                name="time"
                value={t.value}
                checked={picked === t.value}
                onChange={() => setTime(t.value)}
                required
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Your child's first and last name">
        <Input name="child" required maxLength={120} defaultValue={state.values?.child} autoComplete="off" />
      </Field>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Parents or guardians coming</legend>
        <p className="-mt-3 text-sm text-muted">Each person gets the confirmation, calendar invite, and reminder.</p>
        {parents.map((p, i) => (
          <fieldset key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            {/* Says which parent each "Name" and "Email" belongs to; shown once there's more than one. */}
            <legend className={parents.length > 1 ? "px-1 text-sm font-semibold text-muted" : "sr-only"}>Parent or guardian {i + 1}</legend>
            <Field label="Name">
              <Input required maxLength={120} value={p.name} onChange={(e) => set(i, { name: e.target.value })} autoComplete={i ? "off" : "name"} />
            </Field>
            <Field label="Email">
              <Input
                required
                type="email"
                maxLength={254}
                value={p.email}
                onChange={(e) => set(i, { email: e.target.value })}
                autoComplete={i ? "off" : "email"}
              />
            </Field>
            <Field label="Mobile phone (optional)">
              <Input type="tel" maxLength={30} value={p.phone} onChange={(e) => set(i, { phone: e.target.value })} autoComplete={i ? "off" : "tel"} />
            </Field>
            {parents.length > 1 && (
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="danger"
                  aria-label={`Remove parent or guardian ${i + 1}`}
                  onClick={() => setParents((list) => list.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            )}
          </fieldset>
        ))}
        {parents.length < 4 && (
          <Button type="button" variant="secondary" onClick={() => setParents((list) => [...list, blankParent()])}>
            + Add another parent or guardian
          </Button>
        )}
      </fieldset>

      {askMode && (
        <fieldset>
          <legend className="text-lg font-semibold">How would you like to meet?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[
              { value: "in_person", label: "In person", hint: "Come to the classroom." },
              { value: "video", label: "Video", hint: "Join online." },
            ].map((m) => (
              <label key={m.value} className="flex cursor-pointer gap-3 rounded-lg border border-field-border p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input
                  type="radio"
                  name="mode"
                  value={m.value}
                  required
                  defaultChecked={state.values?.mode === m.value}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                />
                <span>
                  <span className="block font-semibold">{m.label}</span>
                  <span className="block text-sm text-muted">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Anything you'd like to talk about? (optional)" hint="Only your child's teacher sees this. Please leave out health or medical details; share those with the school directly.">
        <Textarea name="note" rows={3} maxLength={500} defaultValue={state.values?.note} />
      </Field>

      <BotCheck />
      <FormMessage error={state.error} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Booking…" disabled={!picked} aria-describedby={picked ? undefined : "book-hint"}>
          Book this time
        </SubmitButton>
        {!picked && (
          <p id="book-hint" className="text-sm text-muted">
            Pick a time above first.
          </p>
        )}
      </div>
    </form>
  );
}
