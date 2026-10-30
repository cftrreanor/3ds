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
}: {
  action: Action;
  remove: () => Promise<ActionState>;
  initial: { name: string; instructions: string | null; adults_only?: boolean; lead_ids?: string[] };
  coordinators: { options: LeadOption[]; pending: string[]; invite: Action };
  leadLabel: string;
  links: JobLinks;
}) {
  const [save, setSave] = useState<SaveState>("idle");
  const setEdited = useStepEdits("details");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submit = useCallback(() => {
    const form = document.getElementById(FORM) as HTMLFormElement | null;
    if (!form) return;
    // A blank name can't save: say so instead of saving half of it.
    if (!form.checkValidity()) {
      setSave("failed");
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

  return (
    <ActionForm id={FORM} action={action} className="space-y-3" resetOnSuccess={false} onEdit={changed}>
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
        <JobBar save={save} retry={submit} remove={remove} links={links} unsaved={unsaved} />
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

/** The job's bar, pinned to the bottom of the screen: whether it's saved, Delete job, Add another job, and the next step. */
function JobBar({
  save,
  retry,
  remove,
  links,
  unsaved,
}: {
  save: SaveState;
  retry: () => void;
  remove: () => Promise<ActionState>;
  links: JobLinks;
  unsaved: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // With a change not saved yet, ask before leaving the job.
  const leave = async (e: React.MouseEvent, href: string) => {
    if (!unsaved) return;
    e.preventDefault();
    const ok = await confirmDialog({
      title: "Leave before it saves?",
      message: "Your last change to this job isn't saved yet.",
      confirmLabel: "Leave anyway",
      cancelLabel: "Stay here",
    });
    if (ok) router.push(href);
  };
  const button =
    "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="space-y-1 rounded-b-lg border-t-2 border-border bg-surface px-4 py-2.5 shadow-[0_-6px_16px_rgb(0_0_0/0.10)] sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-sm" aria-live="polite" role={save === "failed" ? "alert" : undefined}>
          {save === "failed" ? (
            <span className="font-semibold text-danger">
              Not saved. Check the job name.{" "}
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
            disabled={deleting}
            className={`${button} gap-1.5 border border-danger/40 bg-surface text-danger hover:bg-danger/5`}
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Delete this job?",
                message: "Its shifts and things to bring are deleted too. A job with people signed up can't be deleted.",
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
          <Link href={links.addJob} scroll={false} onClick={(e) => leave(e, links.addJob)} className={`${button} bg-brand text-brand-foreground hover:bg-brand-hover`}>
            Add another job
          </Link>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <a href={links.preview} target="_blank" className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline">
          Preview the sign-up page
        </a>
        <Link href={links.next.href} onClick={(e) => leave(e, links.next.href)} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4">
          {links.next.label} →
        </Link>
      </div>
    </div>
  );
}
