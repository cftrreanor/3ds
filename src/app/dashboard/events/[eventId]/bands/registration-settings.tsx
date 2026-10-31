"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { addClassifications, removeClassification, saveRegistrationField, type RegistrationField } from "@/app/dashboard/band-registration-actions";
import { NumberInput } from "@/components/number-input";
import { setPending, useLeaveGuard } from "@/components/pending-edits";
import { Input, Textarea } from "@/components/ui";

/** How long after the last keystroke a field saves itself. */
const SAVE_AFTER_MS = 900;
const PRESETS = {
  uil: ["1A", "2A", "3A", "4A", "5A", "6A"],
  divisions: ["Division I", "Division II", "Division III"],
};

type FieldState = "idle" | "waiting" | "saving" | "saved" | "failed";

/**
 * One field that saves itself a moment after the last change (or at once, like a date). It tells
 * the page-wide record of unsaved edits, so the bar says what's happening and leaving waits for it.
 */
function useAutosave(eventId: string, field: RegistrationField, initial: string, immediate = false) {
  const key = useId();
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<FieldState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);
  // The save, for a retry offered from inside itself (a failed save can be tried again).
  const again = useRef<() => void>(() => {});

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const v = latest.current;
    setState("saving");
    setPending(key, { kind: "saving" });
    try {
      const r = await saveRegistrationField(eventId, field, v);
      if (r.error) {
        setError(r.error);
        setState("failed");
        setPending(key, { kind: "failed", flush: () => again.current() });
        return;
      }
      setError(null);
      // A newer change waiting to save keeps the field "waiting".
      if (latest.current === v) {
        setState("saved");
        setPending(key, null);
      }
    } catch {
      setError("Check your connection, then try again.");
      setState("failed");
      setPending(key, { kind: "failed", flush: () => again.current() });
    }
  }, [eventId, field, key]);
  useEffect(() => {
    again.current = () => void save();
  }, [save]);

  const change = (v: string) => {
    setValue(v);
    latest.current = v;
    setState("waiting");
    setPending(key, { kind: "saving", flush: () => void save() });
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void save();
    else timer.current = setTimeout(() => void save(), SAVE_AFTER_MS);
  };

  useEffect(() => () => setPending(key, null), [key]);
  return { value, change, state, error, retry: save };
}

/** A field's label, hint, box, and, if its save failed, the reason with a Retry, right beside it. */
function AutoField({
  label,
  hint,
  required = false,
  error,
  retry,
  children,
  id,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error: string | null;
  retry: () => void;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">
          Not saved. {error}{" "}
          <button type="button" onClick={retry} className="inline-flex min-h-11 items-center underline underline-offset-4">
            Retry
          </button>
        </p>
      )}
    </div>
  );
}

const failedRing = (state: FieldState) => (state === "failed" ? "border-danger ring-1 ring-danger" : "");

/**
 * Band registration settings (a band contest's step 2, and its Registration settings once it's
 * live): classifications, the deadline, information and a payment link for directors, and who they
 * can call. Each field saves itself; the pinned bar says whether everything is saved, and the way on.
 */
export function RegistrationSettings({
  eventId,
  initial,
  bandsIn,
  contactSaved,
  next,
  draft,
}: {
  eventId: string;
  initial: {
    classifications: string[];
    deadline: string;
    directorInfo: string;
    paymentLink: string;
    chaperoneLimit: number;
    contact: { name: string; phone: string; email: string };
  };
  /** How many bands are registered in each classification (they can't be removed while it's above 0). */
  bandsIn: Record<string, number>;
  contactSaved: boolean;
  /** The way on, in the pinned bar (step 2 of setup goes on to Publish). */
  next?: { href: string; label: string };
  /** Not published yet: say what publishing needs. */
  draft: boolean;
}) {
  const counts = useLeaveGuard("A change to registration");
  const deadline = useAutosave(eventId, "deadline", initial.deadline, true);
  const info = useAutosave(eventId, "directorInfo", initial.directorInfo);
  const pay = useAutosave(eventId, "paymentLink", initial.paymentLink);
  const chaperones = useAutosave(eventId, "chaperoneLimit", String(initial.chaperoneLimit));
  const contactName = useAutosave(eventId, "contactName", initial.contact.name);
  const contactPhone = useAutosave(eventId, "contactPhone", initial.contact.phone);
  const contactEmail = useAutosave(eventId, "contactEmail", initial.contact.email);
  const fields = [deadline, info, pay, chaperones, contactName, contactPhone, contactEmail];

  // Classifications: added and removed one at a time.
  const [list, setList] = useState(initial.classifications);
  const [typed, setTyped] = useState("");
  const [clsError, setClsError] = useState<string | null>(null);
  const [clsBusy, setClsBusy] = useState(false);
  const typedKey = useId();
  useEffect(() => {
    setPending(typedKey, typed.trim() ? { kind: "unadded", flush: () => void add([typed]) } : null);
    return () => setPending(typedKey, null);
    // add is stable enough for a flush; it reads the latest typed text when called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, typedKey]);

  async function add(names: string[]) {
    const clean = names.flatMap((n) => n.split(",")).map((n) => n.trim()).filter(Boolean);
    if (!clean.length) return;
    setClsBusy(true);
    setClsError(null);
    try {
      const r = await addClassifications(eventId, clean);
      if (r.classifications) setList(r.classifications);
      if (r.error) setClsError(r.error);
      else setTyped("");
    } catch {
      setClsError("Check your connection, then try again.");
    }
    setClsBusy(false);
  }
  async function remove(name: string) {
    setClsBusy(true);
    setClsError(null);
    try {
      const r = await removeClassification(eventId, name);
      if (r.classifications) setList(r.classifications);
      if (r.error) setClsError(r.error);
    } catch {
      setClsError("Check your connection, then try again.");
    }
    setClsBusy(false);
  }

  const saving = counts.saving > 0 || clsBusy;
  const failed = counts.failed > 0;
  const anySaved = fields.some((f) => f.state === "saved");
  const missing = [list.length === 0 && "at least one classification", !deadline.value && "a deadline"].filter(Boolean) as string[];
  const box = "w-full";

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card">
      <div className="space-y-7 p-4 sm:p-6">
        {/* Classifications */}
        <fieldset>
          <legend className="text-sm font-semibold">
            Classifications<span aria-hidden> *</span>
          </legend>
          <p id="cls-hint" className="mt-1 text-sm text-muted">
            Bands pick one when they register, and the schedule is grouped by these. Add them one at a time, the way your
            directors know them: 1A through 6A, Class AA, Division I, or Varsity and Non-Varsity.
          </p>
          {list.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Classifications">
              {list.map((c) => {
                const n = bandsIn[c] ?? 0;
                return (
                  <li key={c} className="inline-flex min-h-11 items-center gap-1 rounded-lg border-[1.5px] border-field-border bg-background pl-3 text-sm font-semibold">
                    {c}
                    {n > 0 ? (
                      <span className="pr-3 font-normal text-muted">
                        · {n} {n === 1 ? "band" : "bands"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={clsBusy}
                        onClick={() => void remove(c)}
                        aria-label={`Remove ${c}`}
                        className="inline-flex size-11 items-center justify-center rounded-lg text-lg text-muted hover:text-danger disabled:text-disabled"
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {Object.values(bandsIn).some((n) => n > 0) && (
            <p className="mt-2 text-sm text-muted">A classification with bands in it can&apos;t be removed.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Input
              value={typed}
              onChange={(e) => {
                const v = e.target.value;
                // A comma adds what's before it.
                if (v.includes(",")) void add([v]);
                else setTyped(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add([typed]);
                }
              }}
              onBlur={() => typed.trim() && void add([typed])}
              placeholder={list.length ? "Add another" : "Like 1A or Class AA"}
              aria-label="Add a classification"
              aria-describedby="cls-hint"
              maxLength={40}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={clsBusy || !typed.trim()}
              onClick={() => void add([typed])}
              className="inline-flex min-h-11 items-center rounded-md border-[1.5px] border-field-border bg-surface px-4 text-sm font-semibold hover:border-brand disabled:cursor-not-allowed disabled:border-dashed disabled:text-disabled"
            >
              Add
            </button>
          </div>
          {list.length === 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Or add a common set:</span>
              <button type="button" disabled={clsBusy} onClick={() => void add(PRESETS.uil)} className="inline-flex min-h-11 items-center rounded-md border-[1.5px] border-field-border bg-surface px-4 text-sm font-semibold hover:border-brand">
                1A through 6A
              </button>
              <button type="button" disabled={clsBusy} onClick={() => void add(PRESETS.divisions)} className="inline-flex min-h-11 items-center rounded-md border-[1.5px] border-field-border bg-surface px-4 text-sm font-semibold hover:border-brand">
                Division I through III
              </button>
            </div>
          )}
          {clsError && (
            <p role="alert" className="mt-2 text-sm font-semibold text-danger">
              {clsError}
            </p>
          )}
        </fieldset>

        <AutoField
          id="reg-deadline"
          label="Registration deadline"
          required
          hint="Registration stays open through this day, until 11:59 PM in your event's time zone. Most contests close about three weeks before, so directors have their times in time to book buses."
          error={deadline.error}
          retry={deadline.retry}
        >
          <Input
            id="reg-deadline"
            type="date"
            value={deadline.value}
            onChange={(e) => deadline.change(e.target.value)}
            aria-describedby="reg-deadline-hint"
            className={`max-w-xs ${failedRing(deadline.state)}`}
          />
        </AutoField>

        <AutoField
          id="reg-info"
          label="Information for directors"
          hint="The entry fee and how to pay, where buses park, and warm-up. Shown on the registration page and each band's page."
          error={info.error}
          retry={info.retry}
        >
          <Textarea id="reg-info" value={info.value} onChange={(e) => info.change(e.target.value)} rows={5} maxLength={3000} aria-describedby="reg-info-hint" className={`${box} ${failedRing(info.state)}`} />
        </AutoField>

        <AutoField
          id="reg-pay"
          label="Payment link"
          hint="Optional. If directors pay online, paste the full link. It shows as a “Pay the entry fee” button."
          error={pay.error}
          retry={pay.retry}
        >
          <Input id="reg-pay" type="url" inputMode="url" value={pay.value} onChange={(e) => pay.change(e.target.value)} aria-describedby="reg-pay-hint" className={`${box} ${failedRing(pay.state)}`} />
        </AutoField>

        <fieldset>
          <legend className="text-sm font-semibold">Contact for directors</legend>
          <p className="mt-1 text-sm text-muted">
            Only directors registered for this event, and your team, can see this. Call and Text buttons appear for directors the
            day before and on the day itself.
            {!contactSaved && " We've filled in your details. Change them if someone else handles bands."}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <AutoField id="reg-cname" label="Name" error={contactName.error} retry={contactName.retry}>
              <Input id="reg-cname" value={contactName.value} onChange={(e) => contactName.change(e.target.value)} autoComplete="name" className={`${box} ${failedRing(contactName.state)}`} />
            </AutoField>
            <AutoField id="reg-cphone" label="Mobile" error={contactPhone.error} retry={contactPhone.retry}>
              <Input id="reg-cphone" type="tel" inputMode="tel" value={contactPhone.value} onChange={(e) => contactPhone.change(e.target.value)} className={`${box} ${failedRing(contactPhone.state)}`} />
            </AutoField>
            <AutoField id="reg-cemail" label="Email" error={contactEmail.error} retry={contactEmail.retry}>
              <Input id="reg-cemail" type="email" value={contactEmail.value} onChange={(e) => contactEmail.change(e.target.value)} className={`${box} ${failedRing(contactEmail.state)}`} />
            </AutoField>
          </div>
        </fieldset>

        <AutoField id="reg-chap" label="Chaperone limit per band" hint="The most chaperones a band can bring." error={chaperones.error} retry={chaperones.retry}>
          <NumberInput id="reg-chap" value={chaperones.value} onChange={(e) => chaperones.change(e.target.value)} maxLength={3} aria-describedby="reg-chap-hint" className={`max-w-[8rem] ${failedRing(chaperones.state)}`} />
        </AutoField>
      </div>

      {/* Pinned to the bottom of the screen: whether everything is saved, and the way on. */}
      <div className="sticky bottom-[var(--day-bar,0px)] z-10 rounded-b-xl border-t-2 border-border bg-surface px-4 py-3 shadow-[0_-6px_16px_rgb(0_0_0/0.10)] sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-sm" aria-live="polite" role={failed ? "alert" : undefined}>
            {failed ? (
              <span className="font-semibold text-danger">Not saved. See the marked field.</span>
            ) : saving ? (
              <span className="text-muted">Saving…</span>
            ) : counts.unadded ? (
              <span className="font-medium text-warning">
                <span aria-hidden>◆ </span>A classification is typed but not added. Press Enter to add it.
              </span>
            ) : anySaved ? (
              <span className="font-medium">
                <span aria-hidden className="text-success">
                  ✓{" "}
                </span>
                Saved
              </span>
            ) : (
              <span className="text-muted">Changes save automatically</span>
            )}
          </p>
          {next && (
            <Link href={next.href} className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover">
              {next.label} →
            </Link>
          )}
        </div>
        {draft && missing.length > 0 && (
          <p className="mt-1.5 text-sm text-muted">
            You can leave and come back. Before you publish, add {missing.join(" and ")}.
          </p>
        )}
      </div>
    </div>
  );
}
