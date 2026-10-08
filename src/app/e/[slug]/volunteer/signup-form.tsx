"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { ActionPendingContext } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import type { Companion, SignupState } from "./actions";

export type PublicShift = {
  id: string;
  title: string;
  when: string;
  description: string | null;
  spotsLeft: number;
};
export type PublicStation = {
  id: string;
  name: string;
  location: string | null;
  instructions: string | null;
  /** No one under 18 on this station's shifts. */
  adults_only: boolean;
  shifts: PublicShift[];
};

export function SignupForm({
  action,
  stations,
  disabled,
}: {
  action: (prev: SignupState, formData: FormData) => Promise<SignupState>;
  stations: PublicStation[];
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startedAt] = useState(() => Date.now());
  const [activeId, setActiveId] = useState(stations[0]?.id);
  const [minor, setMinor] = useState(false);
  // Others signed up with them (a spouse, their student): same shifts, same phone.
  const [companions, setCompanions] = useState<Companion[]>([]);
  const groupSize = 1 + companions.length;
  const anyMinor = minor || companions.some((c) => c.minor);
  const setCompanion = (i: number, change: Partial<Companion>) =>
    setCompanions((prev) => prev.map((c, j) => (j === i ? { ...c, ...change } : c)));

  if (state.confirmed) {
    return (
      <Card className="space-y-4" role="status">
        <h2 className="text-xl font-semibold">You&apos;re signed up! 🎉</h2>
        {state.confirmed.others.length > 0 && (
          <p className="text-sm">
            Also signed up for {state.confirmed.shifts.length === 1 ? "this shift" : "these shifts"}:{" "}
            <span className="font-medium">{state.confirmed.others.join(", ")}</span>
          </p>
        )}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {state.confirmed.shifts.map((s) => (
            <li key={s.title + s.detail} className="px-4 py-3">
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-muted">{s.detail}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                <a href={s.googleUrl} target="_blank" rel="noreferrer" className="font-medium text-brand underline-offset-4 hover:underline">
                  Add to Google Calendar
                </a>
                <a href={s.icsUrl} className="font-medium text-brand underline-offset-4 hover:underline">
                  Apple / Outlook calendar
                </a>
              </p>
            </li>
          ))}
        </ul>
        {state.confirmed.alreadySignedUp > 0 && (
          <p className="text-sm text-muted">
            {state.confirmed.alreadySignedUp === 1 ? "One shift was" : `${state.confirmed.alreadySignedUp} shifts were`}{" "}
            already booked under this email, so we left {state.confirmed.alreadySignedUp === 1 ? "it" : "them"} as is.
          </p>
        )}
        <p className="leading-7 text-muted">
          {state.confirmed.emailSent ? (
            <>
              We emailed a confirmation with calendar invites to{" "}
              <strong className="text-foreground">{state.confirmed.email}</strong>.
            </>
          ) : (
            <>Save this page or take a screenshot so you have your times.</>
          )}{" "}
          This device will remember your signup, so you can come back anytime to view or cancel it. No login needed.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/my?as=${encodeURIComponent(state.confirmed.email)}`}
            className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            View my shifts
          </Link>
          {/* A full reload brings back a fresh form with up-to-date open spots. */}
          <a
            href={pathname}
            className="inline-flex min-h-11 items-center rounded-md border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-soft"
          >
            Sign up for more shifts
          </a>
        </div>
      </Card>
    );
  }

  // The form is submitted by hand (no reset), so choices and typing survive an error.
  const chosen = selected;
  // Picks across every station, for the summary above the Sign up button.
  const picks = stations.flatMap((st) => st.shifts.filter((sh) => chosen.has(sh.id)).map((sh) => ({ ...sh, station: st.name })));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-8"
    >
      <ActionPendingContext value={pending}>
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Bot trap: hidden from people, tempting to scripts. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <section aria-labelledby="pick">
        <h2 id="pick" className="text-xl font-semibold">
          1. Pick your shifts
        </h2>
        <p className="mt-1 text-sm text-muted">
          {stations.length > 1 ? "Each tab is a station. " : ""}Choose as many shifts as you like, as long as the times
          don&apos;t overlap.
        </p>

        {stations.length > 1 && (
          <div role="tablist" aria-label="Stations" className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-1 border-b border-border">
              {stations.map((st) => {
                const active = st.id === activeId;
                const open = st.shifts.reduce((n, sh) => n + Math.max(sh.spotsLeft, 0), 0);
                const picked = st.shifts.filter((sh) => chosen.has(sh.id)).length;
                return (
                  <button
                    key={st.id}
                    type="button"
                    role="tab"
                    id={`tab-${st.id}`}
                    aria-selected={active}
                    aria-controls={`panel-${st.id}`}
                    onClick={() => setActiveId(st.id)}
                    className={`-mb-px flex flex-col items-start border-b-2 px-4 py-2 text-left text-sm ${
                      active ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      {st.name}
                      {picked > 0 && (
                        <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-brand-foreground">{picked}</span>
                      )}
                    </span>
                    <span className="text-xs font-normal text-muted">{open > 0 ? `${open} open spot${open === 1 ? "" : "s"}` : "Full"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Every station stays in the form (hidden tabs included), so picks on other tabs still submit. */}
        {stations.map((st) => (
          <Card
            key={st.id}
            id={`panel-${st.id}`}
            role={stations.length > 1 ? "tabpanel" : undefined}
            aria-labelledby={stations.length > 1 ? `tab-${st.id}` : undefined}
            hidden={st.id !== activeId}
            className="mt-4 p-4 sm:p-5"
          >
            <h3 className="font-semibold">
              {st.name}
              {st.adults_only && (
                <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs font-semibold ring-1 ring-border">Adults only (18+)</span>
              )}
            </h3>
            {st.adults_only && anyMinor && (
              <p className="mt-1 text-sm text-danger">Someone in your group is under 18, so these shifts aren&apos;t available.</p>
            )}
            {st.location && <p className="text-sm text-muted">{st.location}</p>}
            {st.instructions && <p className="mt-2 text-sm leading-6 text-muted">{st.instructions}</p>}
            <ul className="mt-3 space-y-2">
              {st.shifts.map((s) => {
                const isChosen = chosen.has(s.id);
                // A group signs up together, so a shift needs a spot for everyone.
                const full = s.spotsLeft < groupSize && !isChosen;
                const adultsOnly = st.adults_only && anyMinor && !isChosen;
                return (
                  <li key={s.id}>
                    <label
                      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                        full || adultsOnly
                          ? "cursor-not-allowed border-border opacity-60"
                          : isChosen
                            ? "border-brand bg-brand-soft"
                            : "border-border hover:border-brand"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="shiftIds"
                        value={s.id}
                        checked={isChosen}
                        disabled={full || adultsOnly || disabled}
                        onChange={() => toggle(s.id)}
                        className="h-5 w-5 shrink-0 accent-[var(--brand)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{s.when}</span>
                        <span className="block text-sm text-muted">
                          {s.title}
                          {s.description ? ` · ${s.description}` : ""}
                        </span>
                      </span>
                      <span className={`shrink-0 text-sm font-medium ${full ? "text-muted" : ""}`}>
                        {s.spotsLeft <= 0 ? "Full" : full ? `Only ${s.spotsLeft} left` : `${s.spotsLeft} left`}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </section>

      <section aria-labelledby="you">
        <h2 id="you" className="text-xl font-semibold">
          2. Your details
        </h2>
        <Card className="mt-4 space-y-4 p-4 sm:p-5">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="minor"
              checked={minor}
              onChange={(e) => setMinor(e.target.checked)}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            I&apos;m under 18 or a student
          </label>
          <Field
            label={minor ? "First name and last initial" : "Full name"}
            hint={minor ? "For example, Emma R. We only keep your last initial." : undefined}
          >
            <Input name="fullName" autoComplete={minor ? "off" : "name"} required defaultValue={state.values?.fullName} />
          </Field>
          <Field label={minor ? "Parent or guardian's email" : "Email"} hint="We'll send the confirmation here.">
            <Input name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={state.values?.email} />
          </Field>
          <Field
            label={minor ? "Parent or guardian's cell phone" : "Cell phone"}
            hint={
              companions.length
                ? `This is the number for everyone in your group${anyMinor ? " (as the guardian's number for anyone under 18)" : ""}. Only their section lead sees it, and only on event day.`
                : "Only your section lead sees this, and only on event day."
            }
          >
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={state.values?.phone} />
          </Field>

          <input type="hidden" name="companions" value={JSON.stringify(companions)} />
          {companions.map((c, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Person {i + 2}</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-8 px-2 text-xs"
                  onClick={() => setCompanions((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
              <Input
                value={c.name}
                onChange={(e) => setCompanion(i, { name: e.target.value })}
                placeholder={c.minor ? "First name and last initial" : "Their full name"}
                aria-label={`Person ${i + 2} name`}
                maxLength={200}
                required
                autoComplete="off"
              />
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={c.minor}
                  onChange={(e) => setCompanion(i, { minor: e.target.checked })}
                  className="h-5 w-5 accent-[var(--brand)]"
                />
                Under 18 or a student
              </label>
              {c.minor && <p className="text-xs text-muted">We only keep their first name and last initial.</p>}
            </div>
          ))}
          {companions.length < 4 && (
            <div>
              <Button
                type="button"
                variant="secondary"
                className="min-h-10 px-3 text-sm"
                onClick={() => setCompanions((prev) => [...prev, { name: "", minor: false }])}
              >
                + Add someone else
              </Button>
              <p className="mt-1 text-xs text-muted">Signing up with a spouse or your student? They&apos;ll be on the same shifts.</p>
            </div>
          )}
        </Card>
      </section>

      <div className="space-y-3">
        {picks.length > 0 && (
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-sm font-semibold">Your picks</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {picks.map((p) => (
                <li key={p.id}>
                  <span className="font-medium">{p.station}</span> <span className="text-muted">· {p.when}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <FormMessage error={state.error} />
        <SubmitButtonWithCount count={chosen.size} people={groupSize} disabled={disabled} />
      </div>
      </ActionPendingContext>
    </form>
  );
}

function SubmitButtonWithCount({ count, people, disabled }: { count: number; people: number; disabled?: boolean }) {
  return (
    <SubmitButton className="w-full text-base" disabled={disabled || count === 0} pendingText="Signing you up…">
      {count === 0
        ? "Pick at least one shift"
        : `Sign up ${people > 1 ? `${people} people ` : ""}for ${count} shift${count === 1 ? "" : "s"}`}
    </SubmitButton>
  );
}
