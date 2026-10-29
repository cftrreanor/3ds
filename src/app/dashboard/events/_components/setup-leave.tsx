"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

/** Sent by a form once its save went through or didn't (ActionForm, the file form). */
export const FORM_SAVED = "form-saved";
export const FORM_FAILED = "form-failed";

// Each way off a step: what the window's two buttons and its last sentence say.
const WAYS = {
  // A setup page's tabs (Band Registration), with something half-edited.
  tab: {
    save: "Save and switch",
    discard: "Discard changes and switch",
    then: "Save it before you switch tabs, or switch without it.",
    changed: "You changed something here and didn't save it.",
  },
  // Booths & Partners: another zone's tab, with a booth half-edited.
  zone: {
    save: "Save and switch",
    discard: "Discard changes and switch",
    then: "Save it before you switch zones, or switch without it.",
    changed: "You changed a booth or zone here and didn't save it.",
  },
  // Team setup's role tabs, with an invitation typed but not sent.
  invite: {
    save: "Send and switch",
    discard: "Switch without sending",
    then: "Send it before you switch tabs, or switch without it.",
    changed: "You started an invitation here and didn't send it.",
  },
  skip: { save: "Save and come back", discard: "Discard changes and skip", then: "Save it and come back to finish later, or skip without it." },
  back: { save: "Save and go back", discard: "Discard changes and go back", then: "Save it before you go back, or go back without it." },
  leave: { save: "Save and finish later", discard: "Discard changes and leave", then: "Save it and finish later, or leave without it." },
};

/**
 * A way off a guided setup step (Skip for now, Back, Save and finish later).
 * With nothing typed or changed on the step, it just goes. With changes not
 * yet saved, it asks first: save them and go, or go without them. A form that
 * moves on by itself once saved (it has a `next` box) is sent here instead.
 */
export function LeaveStepLink({
  href,
  way,
  className,
  children,
  scroll,
  current,
}: {
  href: string;
  way: keyof typeof WAYS;
  className: string;
  children: React.ReactNode;
  /** false: keep the scroll position (a row of tabs). */
  scroll?: boolean;
  /** aria-current, for a tab. */
  current?: boolean;
}) {
  const words = WAYS[way];
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
        // A form that goes to the next step once saved goes where this link does instead.
        const next = form.elements.namedItem("next");
        if (next instanceof HTMLInputElement) next.value = href;
        form.requestSubmit();
      });
      // The form shows what went wrong.
      if (!ok) {
        setSaving(false);
        setAsking(false);
        return;
      }
    }
    go();
  };

  // Close the window too: the link stays on screen when only the page's search changes (a zone's tab).
  const go = () => {
    setSaving(false);
    setAsking(false);
    router.push(href, { scroll: scroll ?? true });
  };

  return (
    <>
      <Link
        href={href}
        scroll={scroll}
        aria-current={current ? "page" : undefined}
        className={className}
        onClick={(e) => {
          if (!unsaved().length || e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          setAsking(true);
        }}
      >
        {children}
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
            aria-labelledby="leave-step-title"
            className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-6 text-foreground shadow-elevated backdrop:bg-[#071a31]/50"
          >
            <h2 id="leave-step-title" className="text-xl font-semibold">
              Save your changes first?
            </h2>
            <p className="mt-3 leading-7 text-muted">
              {"changed" in words ? words.changed : "You changed something on this step and didn't save it."} {words.then}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:whitespace-nowrap">
              <Button type="button" variant="danger" disabled={saving} onClick={go}>
                {words.discard}
              </Button>
              <Button type="button" disabled={saving} aria-busy={saving} onClick={() => void saveAndGo()}>
                {saving ? "Saving…" : words.save}
              </Button>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
