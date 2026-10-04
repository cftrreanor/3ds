"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { ActionPendingContext } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, FormMessage, Input } from "@/components/ui";
import type { SignupState } from "./actions";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startedAt] = useState(() => Date.now());

  if (state.confirmed) {
    return (
      <Card className="space-y-4" role="status">
        <h2 className="text-xl font-semibold">You&apos;re signed up! 🎉</h2>
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
        <Link
          href={`/my?as=${encodeURIComponent(state.confirmed.email)}`}
          className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          View my shifts
        </Link>
      </Card>
    );
  }

  // The form is submitted by hand (no reset), so choices and typing survive an error.
  const chosen = selected;
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
        <h2 id="pick" className="text-lg font-semibold">
          1. Pick your shifts
        </h2>
        <p className="mt-1 text-sm text-muted">Choose as many as you like, as long as the times don&apos;t overlap.</p>
        <div className="mt-4 space-y-4">
          {stations.map((st) => (
            <Card key={st.id} className="p-4 sm:p-5">
              <h3 className="font-semibold">{st.name}</h3>
              {st.location && <p className="text-sm text-muted">{st.location}</p>}
              {st.instructions && <p className="mt-2 text-sm leading-6 text-muted">{st.instructions}</p>}
              <ul className="mt-3 space-y-2">
                {st.shifts.map((s) => {
                  const full = s.spotsLeft <= 0;
                  const isChosen = chosen.has(s.id);
                  return (
                    <li key={s.id}>
                      <label
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                          full
                            ? "cursor-not-allowed border-border opacity-60"
                            : isChosen
                              ? "border-brand bg-accent-soft"
                              : "border-border hover:border-brand"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="shiftIds"
                          value={s.id}
                          checked={isChosen}
                          disabled={full || disabled}
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
                          {full ? "Full" : `${s.spotsLeft} left`}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="you">
        <h2 id="you" className="text-lg font-semibold">
          2. Your details
        </h2>
        <Card className="mt-4 space-y-4 p-4 sm:p-5">
          <Field label="Full name">
            <Input name="fullName" autoComplete="name" required defaultValue={state.values?.fullName} />
          </Field>
          <Field label="Email" hint="We'll send your confirmation here.">
            <Input name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={state.values?.email} />
          </Field>
          <Field label="Mobile phone" hint="Only your section lead sees this, and only on event day.">
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={state.values?.phone} />
          </Field>
        </Card>
      </section>

      <div className="space-y-3">
        <FormMessage error={state.error} />
        <SubmitButtonWithCount count={chosen.size} disabled={disabled} />
      </div>
      </ActionPendingContext>
    </form>
  );
}

function SubmitButtonWithCount({ count, disabled }: { count: number; disabled?: boolean }) {
  return (
    <SubmitButton className="w-full text-base" disabled={disabled || count === 0} pendingText="Signing you up…">
      {count === 0 ? "Pick at least one shift" : `Sign up for ${count} shift${count === 1 ? "" : "s"}`}
    </SubmitButton>
  );
}
