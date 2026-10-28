"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

/**
 * "Sign out", asking where: just this device (the usual), or every device
 * signed in to the account (a lost phone, a shared computer).
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
            <h2 id="sign-out-title" className="text-lg font-semibold">
              Sign out
            </h2>
            <p className="mt-1 text-sm text-muted">Where do you want to sign out?</p>
            <form action="/auth/signout" method="post" className="mt-4 space-y-2">
              <Button name="scope" value="local" className="w-full justify-start text-left">
                This device
              </Button>
              <Button name="scope" value="global" variant="secondary" className="w-full flex-col items-start! gap-0! py-2 text-left">
                <span>All devices</span>
                <span className="text-xs font-normal text-muted">Signs you out on every phone and computer, like after losing a phone</span>
              </Button>
            </form>
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Never mind
              </Button>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
