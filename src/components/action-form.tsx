"use client";

import { createContext, use, useActionState, useEffect, useRef, useState, startTransition, type ReactNode } from "react";
import { confirmDialog, confirmFromText, shareDialog } from "@/components/confirm-dialog";
import type { ActionState } from "@/lib/action-state";
import { toast } from "./toaster";
import { FormMessage } from "./ui";

/** Lets <SubmitButton> know a manually-submitted ActionForm is saving. */
export const ActionPendingContext = createContext(false);

const FieldErrorsContext = createContext<Record<string, string>>({});

/** The current per-field errors of the surrounding ActionForm, keyed by input name. */
export function useFieldErrors() {
  return use(FieldErrorsContext);
}

/**
 * A form wired to a Server Action that returns ActionState. Shows the error or
 * success message, keeps what the user typed when there's an error, and
 * clears the form after a success. `validate` checks answers in the browser
 * first, so simple slips don't need a trip to the server. After an error, the
 * first field with a problem (or else the message) is scrolled to and focused.
 */
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  confirmLabel,
  resetOnSuccess = true,
  onSuccess,
  validate,
  noValidate,
  onEdit,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  /** Ask first, in our confirm window: "The question? What happens." */
  confirmMessage?: string;
  /** The confirm window's action button ("Delete sign-up"); "Continue" if not given. */
  confirmLabel?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  validate?: (data: FormData) => ActionState | null;
  /** Skip the browser's own one-at-a-time pop-ups, when `validate` shows every problem itself. */
  noValidate?: boolean;
  /** Called as the user types or picks anything (after a reset too), with the form. */
  onEdit?: (form: HTMLFormElement) => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // A problem found in the browser, shown instead of the last server answer.
  const [checked, setChecked] = useState<ActionState | null>(null);
  const shown = checked ?? state;
  const ref = useRef<HTMLFormElement>(null);
  const onEditRef = useRef(onEdit);
  useEffect(() => {
    onEditRef.current = onEdit;
  });

  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      // Something went public: show its link to share, not just a toast.
      if (state.share) shareDialog(state.share);
      else if (state.message) toast(state.message);
      onSuccess?.();
      if (resetOnSuccess && ref.current) onEditRef.current?.(ref.current);
    }
    // Only when a new answer comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const form = ref.current;
    if (!shown.error || !form) return;
    const bad = new Set(Object.keys(shown.fieldErrors ?? {}));
    const field = [...form.elements].find(
      (el): el is HTMLElement => el instanceof HTMLElement && el.tabIndex >= 0 && bad.has(el.getAttribute("name") ?? ""),
    );
    const target = field ?? form.querySelector<HTMLElement>("[data-form-message]");
    target?.scrollIntoView({ block: field ? "center" : "nearest" });
    target?.focus({ preventScroll: true });
  }, [shown]);

  return (
    <form
      ref={ref}
      className={className}
      noValidate={noValidate}
      action={formAction}
      onInput={onEdit ? (e) => onEdit(e.currentTarget) : undefined}
      onChange={onEdit ? (e) => onEdit(e.currentTarget) : undefined}
      onSubmit={async (e) => {
        // Submit manually so React doesn't wipe the inputs when we show an error.
        e.preventDefault();
        // With the button pressed, so a form with two buttons (name="intent") knows which.
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        const problem = validate?.(data);
        setChecked(problem ?? null);
        if (problem) return;
        if (confirmMessage && !(await confirmDialog(confirmFromText(confirmMessage, confirmLabel ? { confirmLabel } : undefined)))) return;
        startTransition(() => formAction(data));
      }}
    >
      <ActionPendingContext value={pending}>
        {/* Success shows as a toast (top right); errors stay with the form. */}
        <FormMessage error={shown.error} />
        <FieldErrorsContext value={shown.fieldErrors ?? {}}>{children}</FieldErrorsContext>
      </ActionPendingContext>
    </form>
  );
}
