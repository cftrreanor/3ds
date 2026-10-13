"use client";

import { useEffect } from "react";

/**
 * The platform's pattern for required answers, on every form (mounted once,
 * in the root layout):
 *
 *   - A form's submit buttons look faded until its required boxes are filled
 *     in (they still work, so tapping one early isn't a dead end).
 *   - Only once they try to save with a required box empty does anything
 *     turn red: each box still needed is outlined, a line under the form says
 *     what to do, and the first one gets the focus (instead of the browser's
 *     one-at-a-time pop-up).
 *
 * It works from the browser's own `required` (and type/pattern) checks, so a
 * form opts in just by marking its required boxes. Forms with `noValidate`
 * (which check everything themselves) are left alone. Styles: globals.css.
 */
export function RequiredFields() {
  useEffect(() => {
    const checkable = (form: HTMLFormElement) => !form.noValidate;

    const update = (form: HTMLFormElement) => {
      if (!checkable(form)) return;
      // Not form.checkValidity(): that reports every empty box as if they'd tried to save.
      const ready = [...form.elements].every((el) => !(el as HTMLInputElement).willValidate || (el as HTMLInputElement).validity.valid);
      for (const button of form.querySelectorAll<HTMLButtonElement>("button[type=submit], button:not([type])")) {
        button.toggleAttribute("data-not-ready", !ready);
      }
      if (ready) form.removeAttribute("data-missing");
      else if (form.hasAttribute("data-missing")) form.setAttribute("data-missing", missingKind(form));
    };
    const updateAll = () => document.querySelectorAll("form").forEach(update);

    const onEdit = (e: Event) => {
      const form = (e.target as Element | null)?.closest?.("form");
      if (form) update(form);
    };

    // The browser found a box it won't submit: mark the whole form instead of its pop-up.
    const onInvalid = (e: Event) => {
      const field = e.target as HTMLElement;
      const form = field.closest("form");
      if (!form || !checkable(form)) return;
      e.preventDefault();
      form.setAttribute("data-missing", missingKind(form));
      // Every invalid box fires this; only the first one gets the focus.
      const first = form.querySelector<HTMLElement>(":invalid:not(form):not(fieldset)");
      if (first === field) {
        first.focus({ preventScroll: true });
        first.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };

    // Forms appear as pages change and sections open; a reset empties them again.
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateAll);
    };
    const observer = new MutationObserver(later);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    document.addEventListener("reset", later, true);
    document.addEventListener("invalid", onInvalid, true);
    updateAll();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
      document.removeEventListener("reset", later, true);
      document.removeEventListener("invalid", onInvalid, true);
    };
  }, []);
  return null;
}

/** "fill" when every problem is an empty box, "fix" when something's in the wrong format. */
function missingKind(form: HTMLFormElement) {
  const invalid = [...form.elements].filter(
    (el): el is HTMLInputElement => (el as HTMLInputElement).willValidate && !(el as HTMLInputElement).validity.valid,
  );
  return invalid.every((el) => el.validity.valueMissing) ? "fill" : "fix";
}
