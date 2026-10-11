"use client";

import { createContext, useActionState, useEffect, useRef, startTransition, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { toast } from "./toaster";
import { FormMessage } from "./ui";

/** Lets <SubmitButton> know a manually-submitted ActionForm is saving. */
export const ActionPendingContext = createContext(false);

/**
 * A form wired to a Server Action that returns ActionState. Shows the error or
 * success message, keeps what the user typed when there's an error, and
 * clears the form after a success.
 */
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  resetOnSuccess = true,
  onSuccess,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      if (state.message) toast(state.message);
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      action={formAction}
      onSubmit={(e) => {
        // Submit manually so React doesn't wipe the inputs when we show an error.
        e.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <ActionPendingContext value={pending}>
        {/* Success shows as a toast (top right); errors stay with the form. */}
        <FormMessage error={state.error} />
        {children}
      </ActionPendingContext>
    </form>
  );
}
