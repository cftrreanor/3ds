"use client";

import { useEffect, useRef, useState } from "react";
import { BandForm } from "@/components/band-form";
import type { ActionState } from "@/lib/action-state";
import { ConfirmCode } from "./confirm-code";
import { startGuestRegistration, type GuestState } from "./guest-actions";

/**
 * Registering without signing in first: fill in the form, then confirm with
 * the code we email the head director. The form stays (hidden) while they
 * confirm, so "Fix the email address" brings every answer back.
 */
export function GuestRegister({
  eventId,
  classifications,
  chaperoneLimit,
  kind,
}: {
  eventId: string;
  classifications: string[];
  chaperoneLimit: number;
  kind: "band" | "group";
}) {
  const [pending, setPending] = useState<GuestState["pending"] | null>(null);
  const formWrap = useRef<HTMLDivElement>(null);
  const codeWrap = useRef<HTMLDivElement>(null);
  // Bring the code box into view (the form above it is now hidden).
  useEffect(() => {
    if (pending)
      codeWrap.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [pending]);

  async function submit(
    prev: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    const result = await startGuestRegistration(eventId, prev, formData);
    if (result.pending) setPending(result.pending);
    return result;
  }

  return (
    <>
      {pending && (
        <div ref={codeWrap} className="scroll-mt-4">
          <ConfirmCode
            pendingId={pending.id}
            email={pending.email}
            bandName={pending.bandName}
            onFixEmail={() => {
              setPending(null);
              requestAnimationFrame(() => {
                const box = formWrap.current?.querySelector<HTMLInputElement>(
                  'input[name="headDirectorEmail"]',
                );
                box?.scrollIntoView({ block: "center" });
                box?.focus();
              });
            }}
          />
        </div>
      )}
      <div ref={formWrap} hidden={Boolean(pending)}>
        <BandForm
          action={submit}
          classifications={classifications}
          chaperoneLimit={chaperoneLimit}
          submitLabel={`Register ${kind}`}
          kind={kind}
          emailHint="We'll send a code here to confirm your registration."
        />
      </div>
    </>
  );
}
