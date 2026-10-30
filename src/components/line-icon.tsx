import { ICON_PATHS, type IconName } from "@/lib/icons";

/**
 * One of the app's line icons (src/lib/icons.ts), in the text color. `inline` sits it in a line of
 * text, the size of the words around it; otherwise size it with `className`.
 */
export function LineIcon({ name, className = "size-5", inline = false }: { name: IconName; className?: string; inline?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`${inline ? "mr-1 inline-block size-[1.1em] align-[-0.2em]" : ""} shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** A line icon on a soft blue tile: the kinds of event, on cards and headings. */
export function IconTile({ name, size = "md" }: { name: IconName; size?: "sm" | "md" }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand dark:text-foreground ${size === "sm" ? "size-8" : "size-10"}`}>
      <LineIcon name={name} className={size === "sm" ? "size-5" : "size-6"} />
    </span>
  );
}
