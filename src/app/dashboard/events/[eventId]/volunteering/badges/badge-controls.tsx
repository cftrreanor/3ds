"use client";

/** Opens the browser's print window, where "Save as PDF" is one of the printers. */
export function PrintBadgesButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
    >
      Print or save as PDF
    </button>
  );
}
