"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

/** Sent by a form once its save went through or didn't (ActionForm, the file form). */
export const FORM_SAVED = "form-saved";
export const FORM_FAILED = "form-failed";

/**
 * The guided setup's "Skip for now". With nothing typed or changed on the
 * step, it just goes on. With changes not yet saved, it asks first: save them
 * and go on ("Save and come back"), or leave them ("Discard changes and skip").
 */
export function SkipLink({ href, className }: { href: string; className: string }) {
  const router = useRouter();
  const dirty = useRef(new Set<HTMLFormElement>());
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const area = document.getElementById("settings-panel") ?? document.body;
    const forms = dirty.current;
    // Typing or picking in a form marks it changed; saving it clears it.
    const changed = (e: Event) => {
      const form = (e.target as Element | null)?.closest?.("form");
      if (form) forms.add(form);
    };
    const saved = (e: Event) => {
      const form = e.target as HTMLFormElement;
      forms.delete(form);
    };
    area.addEventListener("input", changed);
    area.addEventListener("change", changed);
    area.addEventListener(FORM_SAVED, saved);
    return () => {
      area.removeEventListener("input", changed);
      area.removeEventListener("change", changed);
      area.removeEventListener(FORM_SAVED, saved);
    };
  }, []);

  // A form that's gone (a closed "Add a file") has nothing left to save.
  const unsaved = () => [...dirty.current].filter((f) => f.isConnected);

  const saveAndGo = async () => {
    setSaving(true);
    for (const form of unsaved()) {
      // A box still to fill in: close this and show it (components/required-fields.tsx).
      if (!form.checkValidity()) {
        setSaving(false);
        setAsking(false);
        return;
      }
      const ok = await new Promise<boolean>((resolve) => {
        const done = (e: Event) => {
          form.removeEventListener(FORM_SAVED, done);
          form.removeEventListener(FORM_FAILED, done);
          resolve(e.type === FORM_SAVED);
        };
        form.addEventListener(FORM_SAVED, done);
        form.addEventListener(FORM_FAILED, done);
        form.requestSubmit();
      });
      // The form shows what went wrong.
      if (!ok) {
        setSaving(false);
        setAsking(false);
        return;
      }
    }
    router.push(href);
  };

  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(e) => {
          if (!unsaved().length || e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          setAsking(true);
        }}
      >
        Skip for now
      </Link>
      {asking &&
        createPortal(
          <dialog
            ref={(d) => {
              if (d && !d.open) d.showModal();
            }}
            onCancel={(e) => saving && e.preventDefault()}
            onClose={() => setAsking(false)}
            onClick={(e) => e.target === e.currentTarget && !saving && setAsking(false)}
            aria-labelledby="skip-title"
            className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-6 text-foreground shadow-elevated backdrop:bg-[#071a31]/50"
          >
            <h2 id="skip-title" className="text-xl font-semibold">
              Save your changes first?
            </h2>
            <p className="mt-3 leading-7 text-muted">
              You changed something on this step and didn&apos;t save it. Save it and come back to finish later, or skip without it.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:whitespace-nowrap">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => router.push(href)}>
                Discard changes and skip
              </Button>
              <Button type="button" disabled={saving} aria-busy={saving} onClick={() => void saveAndGo()}>
                {saving ? "Saving…" : "Save and come back"}
              </Button>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
