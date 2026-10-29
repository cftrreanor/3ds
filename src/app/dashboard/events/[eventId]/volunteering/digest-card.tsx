"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { DIGEST_OFF_CONFIRM, DigestChoices } from "@/components/digest-choices";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import type { DigestPrefs } from "@/lib/notify-kinds";

/**
 * Volunteer Setup → Your daily volunteer summary: what your own summary
 * includes. Saving with nothing ticked asks first (only you see it).
 */
export function DigestCard({
  action,
  prefs,
  receiving,
  hostsLink,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  prefs: DigestPrefs;
  /** The hosts picked you for "Volunteer sign-ups" in Email settings. */
  receiving: boolean;
  /** For hosts: where to choose who gets it. */
  hostsLink?: string;
}) {
  const [value, setValue] = useState(prefs);
  const off = !Object.values(value).some(Boolean);
  return (
    <Card>
      <h3 className="text-lg font-semibold">Your daily volunteer summary</h3>
      {receiving ? (
        <>
          <p className="mt-1 text-sm text-muted">One email a day, on days with changes. Choose what it includes; you can change this anytime.</p>
          <ActionForm
            action={action}
            resetOnSuccess={false}
            className="mt-2 space-y-3"
            confirmMessage={off ? DIGEST_OFF_CONFIRM : undefined}
            confirmLabel={off ? "Turn it off" : undefined}
          >
            <DigestChoices name="digest" value={value} onChange={setValue} />
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
          </ActionForm>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">
          You don&apos;t get the daily summary of new sign-ups, changes, and cancellations for this event.{" "}
          {hostsLink ? (
            <a href={hostsLink} className="font-medium text-brand underline-offset-4 hover:underline">
              Choose who gets it in Email settings
            </a>
          ) : (
            "Ask a host to add you in Event settings, under Email settings."
          )}
        </p>
      )}
    </Card>
  );
}
