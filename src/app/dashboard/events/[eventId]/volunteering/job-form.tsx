"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ActionForm } from "@/components/action-form";
import { confirmDialog } from "@/components/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { BinIcon, CoordinatorPicker, type LeadOption } from "../forms";
import type { JobLinks } from "./job-parts";
import { useStepEdits } from "./station-steps";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FORM = "job-details";
/** How long after the last keystroke a job saves itself. */
const SAVE_AFTER_MS = 900;
const noSubscribe = () => () => {};
const OFFLINE = "Check your connection, then try again.";

type SaveState = "idle" | "waiting" | "saving" | "saved" | "failed";

/**
 * A volunteer event's job: its name here (right under "Shifts / Things to bring"), then "More options"
 * drawn further down the card, after its shifts or things to bring. Everything saves itself a moment
 * after the last change; the bar pinned to the bottom says so, and holds Delete job and Add another job.
 */
export function JobForm({
  action,
  remove,
  initial,
  coordinators,
  leadLabel,
  links,
  signedUp,
  ready,
  allReady,
  items,
}: {
  action: Action;
  remove: () => Promise<ActionState>;
  initial: { name: string; instructions: string | null; adults_only?: boolean; lead_ids?: string[] };
  coordinators: { options: LeadOption[]; pending: string[]; invite: Action };
  leadLabel: string;
  links: JobLinks;
  /** Someone has signed up for it, so it can't be deleted. */
  signedUp: boolean;
  ready: boolean;
  allReady: boolean;
  items: boolean;
}) {
  const [save, setSave] = useState<SaveState>("idle");
  const [why, setWhy] = useState<string | null>(null);
  const setEdited = useStepEdits("details");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // A lost connection throws instead of answering: say so, like any other failed save.
  const save$ = useCallback<Action>(
    async (prev, formData) => {
      try {
        const r = await action(prev, formData);
        setWhy(r.error ?? null);
        return r;
      } catch {
        setWhy(OFFLINE);
        return { error: OFFLINE };
      }
    },
    [action],
  );

  const submit = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const form = document.getElementById(FORM) as HTMLFormElement | null;
    if (!form) return;
    // A blank name can't save: say so instead of saving half of it.
    if (!form.checkValidity()) {
      setWhy("A job needs a name.");
      setSave("failed");
      form.dispatchEvent(new Event("form-failed"));
      return;
    }
    setSave("saving");
    form.requestSubmit();
  }, []);

  const changed = useCallback(() => {
    setSave("waiting");
    setEdited(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(submit, SAVE_AFTER_MS);
  }, [setEdited, submit]);

  // The form's own answer: saved, or not.
  useEffect(() => {
    const form = document.getElementById(FORM);
    if (!form) return;
    const ok = () => {
      setSave((s) => (s === "waiting" ? s : "saved"));
      setEdited(false);
    };
    const failed = () => setSave("failed");
    form.addEventListener("form-saved", ok);
    form.addEventListener("form-failed", failed);
    return () => {
      form.removeEventListener("form-saved", ok);
      form.removeEventListener("form-failed", failed);
    };
  }, [setEdited]);

  // Closing the tab before the last change saves: the browser asks first.
  const unsaved = save === "waiting" || save === "saving" || save === "failed";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Switching apps or tabs (a phone's usual way out) saves straight away instead of waiting.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && timer.current) submit();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [submit]);

  // Any link on the page while a change is waiting: save it first, then go. If it can't save, ask.
  useEffect(() => {
    if (!unsaved) return;
    const form = document.getElementById(FORM);
    const guard = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();
      const done = new Promise<boolean>((resolve) => {
        const ok = () => resolve(true);
        const no = () => resolve(false);
        form?.addEventListener("form-saved", ok, { once: true });
        form?.addEventListener("form-failed", no, { once: true });
        setTimeout(no, 8000);
      });
      if (save !== "saving") submit();
      void done.then(async (saved) => {
        if (
          saved ||
          (await confirmDialog({
            title: "Leave before it saves?",
            message: "Your last change to this job isn't saved.",
            confirmLabel: "Leave anyway",
            cancelLabel: "Stay here",
          }))
        )
          router.push(href);
      });
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [unsaved, save, submit, router]);

  return (
    <ActionForm id={FORM} action={save$} className="space-y-3" resetOnSuccess={false} onEdit={changed}>
      <input type="hidden" name="noun" value="job" />
      <Field label="Job name" hint="Like Parking, Litter pickup, or Supplies to bring">
        <Input name="name" required maxLength={80} defaultValue={initial.name} />
      </Field>
      <InSlot id="job-more">
        <details className="group rounded-lg border border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            More options: Coordinators, instructions, and adults only
            <span aria-hidden className="text-brand transition group-open:rotate-90">
              ›
            </span>
          </summary>
          {/* Drawn outside the form: each field names it (form=), and React still passes edits up to it. */}
          <div className="space-y-3 border-t border-border p-3">
            <CoordinatorPicker label={leadLabel} initial={initial.lead_ids ?? []} onChange={changed} formId={FORM} {...coordinators} />
            <Field label="Instructions for volunteers" hint="Optional. What to wear, bring, and do.">
              <Textarea name="instructions" form={FORM} defaultValue={initial.instructions ?? ""} />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="adultsOnly" form={FORM} defaultChecked={initial.adults_only ?? false} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
              <span>
                <span className="font-medium">Adults only (18+)</span>
                <span className="block text-muted">No one under 18 can sign up for this job or be added as a walk-up.</span>
              </span>
            </label>
          </div>
        </details>
      </InSlot>
      <InSlot id="signup-bar">
        <JobBar save={save} why={why} retry={submit} remove={remove} links={links} signedUp={signedUp} ready={ready} allReady={allReady} items={items} />
      </InSlot>
    </ActionForm>
  );
}

/** Draws its children into a placeholder elsewhere on the job's card (after the shifts, or its pinned bar). */
function InSlot({ id, children }: { id: string; children: ReactNode }) {
  const slot = useSyncExternalStore(
    noSubscribe,
    () => document.getElementById(id),
    () => null,
  );
  return slot ? createPortal(children, slot) : null;
}

const SAVE_WORDS: Record<SaveState, string> = {
  idle: "Changes save automatically",
  waiting: "Saving…",
  saving: "Saving…",
  saved: "Saved",
  failed: "Not saved",
};

/**
 * The job's bar, pinned to the bottom of the screen: whether it's saved, Delete job, Add another job,
 * and the next step. Until the job has a shift or a thing to bring, the ways on are greyed out with a
 * note saying why; once every job has one, publishing is the main button.
 */
function JobBar({
  save,
  why,
  retry,
  remove,
  links,
  signedUp,
  ready,
  allReady,
  items,
}: {
  save: SaveState;
  why: string | null;
  retry: () => void;
  remove: () => Promise<ActionState>;
  links: JobLinks;
  signedUp: boolean;
  ready: boolean;
  allReady: boolean;
  items: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition";
  const filled = `${button} bg-brand text-brand-foreground hover:bg-brand-hover`;
  const outline = `${button} border-[1.5px] border-brand bg-surface text-brand hover:bg-brand-soft`;
  // Greyed out, and not a link, until the job is ready (the note says why).
  const off = `${button} cursor-not-allowed border-[1.5px] border-dashed border-field-border bg-surface text-muted`;
  const needs = items ? "a thing to bring" : "a shift";
  return (
    <div className="space-y-1.5 rounded-b-lg border-t-2 border-border bg-surface px-4 py-2.5 shadow-[0_-6px_16px_rgb(0_0_0/0.10)] sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-sm" aria-live="polite" role={save === "failed" ? "alert" : undefined}>
          {save === "failed" ? (
            <span className="font-semibold text-danger">
              Not saved. {why ?? "Try again."}{" "}
              <button type="button" onClick={retry} className="underline underline-offset-2">
                Try again
              </button>
            </span>
          ) : (
            <span className={save === "saved" ? "font-medium" : "text-muted"}>
              {save === "saved" && <span aria-hidden className="text-success">✓ </span>}
              {SAVE_WORDS[save]}
            </span>
          )}
        </p>
        <div className="flex w-full gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <button
            type="button"
            disabled={deleting || signedUp}
            aria-describedby={signedUp ? "job-bar-locked" : undefined}
            className={`${button} gap-1.5 border border-danger/40 bg-surface text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:border-dashed disabled:border-field-border disabled:text-muted`}
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Delete this job?",
                message: "Its shifts and things to bring are deleted too.",
                confirmLabel: "Delete job",
                danger: true,
              });
              if (!ok) return;
              setDeleting(true);
              const r = await remove();
              setDeleting(false);
              setError(r.error ?? null);
            }}
          >
            {!deleting && <BinIcon />}
            {deleting ? "Deleting…" : "Delete job"}
          </button>
          {ready ? (
            <Link href={links.addJob} scroll={false} className={allReady ? outline : filled}>
              Add another job
            </Link>
          ) : (
            <span role="link" aria-disabled="true" aria-describedby="job-bar-note" className={off}>
              Add another job
            </span>
          )}
        </div>
      </div>
      {!ready && (
        <p id="job-bar-note" className="text-sm font-medium text-warning">
          <span aria-hidden>◆ </span>
          This job needs {needs} before volunteers can see it. Add one above.
        </p>
      )}
      {signedUp && (
        <p id="job-bar-locked" className="text-sm text-muted">
          People have signed up for this job, so it can&apos;t be deleted.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <a href={links.preview} target="_blank" className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline">
          Preview the sign-up page
        </a>
        {!ready ? (
          <span role="link" aria-disabled="true" aria-describedby="job-bar-note" className="inline-flex min-h-11 cursor-not-allowed items-center text-sm font-semibold text-muted">
            {links.next.label} →
          </span>
        ) : allReady ? (
          <Link href={links.next.href} className={filled}>
            {links.next.label} →
          </Link>
        ) : (
          <Link href={links.next.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4">
            {links.next.label} →
          </Link>
        )}
      </div>
    </div>
  );
}
