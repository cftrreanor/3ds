"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button, Card, Field, FormMessage, Input, Select } from "@/components/ui";
import type { ParentState } from "./actions";

type Child = { name: string; teacher: string; grade: string };
const blankChild = (): Child => ({ name: "", teacher: "", grade: "" });

/**
 * Parent registration: the parent, each child (name, teacher, grade), and the
 * photo ID promise. With `initial`, the parent is changing their registration
 * from their own link (the email can't change).
 */
export function ParentsForm({
  action,
  grades,
  idReminder,
  initial,
}: {
  action: (prev: ParentState, formData: FormData) => Promise<ParentState>;
  grades: readonly string[];
  idReminder: string;
  initial?: NonNullable<ParentState["values"]>;
}) {
  const editing = Boolean(initial);
  const [state, formAction] = useActionState(action, initial ? { values: initial } : {});
  const [startedAt] = useState(() => Date.now());
  const [children, setChildren] = useState<Child[]>(() => state.values?.children ?? [blankChild()]);
  const [adults, setAdults] = useState<string[]>(() => state.values?.otherAdults ?? []);
  const set = (i: number, patch: Partial<Child>) => setChildren((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  if (state.confirmed?.existing) {
    return (
      <Card className="space-y-3" role="status">
        <h2 className="text-2xl font-semibold">Check your email</h2>
        <p className="leading-7">
          This email is already registered for this event, so nothing was changed. We&apos;ve emailed{" "}
          <span className="font-medium">{state.confirmed.email}</span> a link to see, change or cancel that registration.
        </p>
        <p className="text-sm text-muted">Don&apos;t see it? Check your spam folder. We send it at most once every 10 minutes.</p>
      </Card>
    );
  }
  if (state.confirmed) {
    return (
      <Card className="space-y-4 border-success/30 bg-success-soft" role="status">
        <h2 className="text-2xl font-semibold">{state.confirmed.updated ? "Changes saved" : "You're registered"}</h2>
        <ul className="space-y-1">
          {state.confirmed.children.map((c, i) => (
            <li key={i}>
              <span className="font-medium">{c.name}</span>{" "}
              <span className="text-muted">
                · {c.grade} · {c.teacher}
              </span>
            </li>
          ))}
        </ul>
        <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 font-medium">🪪 {idReminder}</p>
        <p className="text-sm text-muted">
          {state.confirmed.emailSent
            ? state.confirmed.updated
              ? `We emailed an updated calendar invite to ${state.confirmed.email}.`
              : `We emailed a calendar invite to ${state.confirmed.email}: add it to your calendar so you don't forget. It has a link to change or cancel, and we'll remind you the day before.`
            : state.confirmed.updated
              ? "Saved. We couldn't send the email, but your changes are in."
              : "We couldn't send the confirmation email, but you're registered."}
        </p>
      </Card>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="children" value={JSON.stringify(children)} />
      <input type="hidden" name="otherAdults" value={JSON.stringify(adults)} />
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden className="hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">You</h2>
        <Field label="Your name">
          <Input name="parentName" required autoComplete="name" defaultValue={state.values?.parentName} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" hint={editing ? "To use a different email, cancel and register again." : "Your confirmation and reminder go here."}>
            <Input name="email" type="email" required autoComplete="email" defaultValue={state.values?.email} readOnly={editing} />
          </Field>
          <Field label="Mobile phone (optional)">
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={state.values?.phone} />
          </Field>
        </div>
<div className="space-y-3 border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium">Other adults coming with you</p>
            <p className="text-sm text-muted">
              A spouse, grandparent or anyone else coming for the same {children.length > 1 ? "children" : "child"}. Each
              adult needs their own photo ID, and the name here must match it.
            </p>
          </div>
          {adults.map((name, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={`Adult ${i + 2}`} className="flex-1">
                <Input
                  value={name}
                  onChange={(e) => setAdults((list) => list.map((a, j) => (j === i ? e.target.value : a)))}
                  required
                  placeholder="First and last name"
                  autoComplete="off"
                />
              </Field>
              <button
                type="button"
                className="min-h-11 px-2 text-sm font-medium text-danger hover:underline"
                onClick={() => setAdults((list) => list.filter((_, j) => j !== i))}
                aria-label={`Remove ${name || `adult ${i + 2}`}`}
              >
                Remove
              </button>
            </div>
          ))}
          {adults.length < 5 && (
            <Button type="button" variant="secondary" onClick={() => setAdults((list) => [...list, ""])}>
              + Add another adult
            </Button>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">{children.length > 1 ? "Your children" : "Your child"}</h2>
        {children.map((c, i) => (
          <fieldset key={i} className={`grid gap-4 sm:grid-cols-[2fr_1.5fr_1fr] ${i > 0 ? "border-t border-border pt-4" : ""}`}>
            <legend className="sr-only">Child {i + 1}</legend>
            <Field label="Child's name">
              <Input value={c.name} onChange={(e) => set(i, { name: e.target.value })} required placeholder="First and last name" />
            </Field>
            <Field label="Teacher's last name">
              <Input value={c.teacher} onChange={(e) => set(i, { teacher: e.target.value })} required placeholder="e.g. Smith" />
            </Field>
            <Field label="Grade">
              <Select value={c.grade} onChange={(e) => set(i, { grade: e.target.value })} required>
                <option value="">Pick…</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            {children.length > 1 && (
              <button
                type="button"
                className="justify-self-start text-sm font-medium text-danger hover:underline sm:col-span-3"
                onClick={() => setChildren((list) => list.filter((_, j) => j !== i))}
              >
                Remove {c.name || "this child"}
              </button>
            )}
          </fieldset>
        ))}
        {children.length < 8 && (
          <Button type="button" variant="secondary" onClick={() => setChildren((list) => [...list, blankChild()])}>
            + Add another child
          </Button>
        )}
      </Card>

      <Card className="space-y-3 border-warning/40 bg-warning-soft">
        <p className="font-semibold">🪪 Photo ID required</p>
        <p className="text-sm leading-6">{idReminder}</p>
        <label className="flex items-start gap-3 text-sm font-medium">
          <input type="checkbox" name="idAgreed" required className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
          I&apos;ll bring a valid government-issued photo ID.
        </label>
      </Card>

      <FormMessage error={state.error} />
      <SubmitButton pendingText={editing ? "Saving…" : "Registering…"} className="w-full sm:w-auto">
        {editing ? "Save changes" : "Register"}
      </SubmitButton>
      <p className="text-xs text-muted">
        Only the school&apos;s event team sees these details, and they&apos;re deleted 30 days after the event.
      </p>
    </form>
  );
}
