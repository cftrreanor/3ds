"use client";

import { use, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { ActionPendingContext } from "./action-form";
import { Button } from "./ui";

/** A submit button that disables itself and shows progress while saving. */
export function SubmitButton({
  pendingText = "Saving…",
  children,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const formStatus = useFormStatus();
  const pending = formStatus.pending || use(ActionPendingContext);
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
