"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

const CHOICES = [
  { value: "local", label: "This device", hint: "Stay signed in on your other phones and computers" },
  { value: "global", label: "All devices", hint: "Signs you out everywhere, like after losing a phone" },
] as const;

/**
 * "Sign out", asking where first: just this device (picked to start), or every
 * device signed in to the account. Then a Sign out button does it.
 */
export function SignOutButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Sign out
      </button>
      {open &&
        createPortal(
          <dialog
            ref={(d) => {
              if (d && !d.open) d.showModal();
            }}
            onClose={() => setOpen(false)}
            aria-labelledby="sign-out-title"
            className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-5 text-foreground shadow-xl backdrop:bg-black/40"
          >
            <form action="/auth/signout" method="post">
              <fieldset>
                <legend id="sign-out-title" className="text-lg font-semibold">
                  Sign out
                </legend>
                <p className="mt-1 text-sm text-muted">Where do you want to sign out?</p>
                <div className="mt-4 space-y-2">
                  {CHOICES.map((c) => (
                    <label
                      key={c.value}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-brand/50 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={c.value}
                        defaultChecked={c.value === "local"}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                      />
                      <span>
                        <span className="block text-sm font-medium">{c.label}</span>
                        <span className="block text-xs text-muted">{c.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Never mind
                </Button>
                <Button type="submit">Sign out</Button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
}
