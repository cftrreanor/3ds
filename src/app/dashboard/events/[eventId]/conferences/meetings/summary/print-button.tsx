"use client";

/** Opens the browser's print window, where "Save as PDF" is one of the printers. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
    >
      Print or save as PDF
    </button>
  );
}
