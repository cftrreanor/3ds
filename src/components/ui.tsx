import type { ComponentProps, ReactNode } from "react";

// Small shared building blocks so every form looks and behaves the same.
// Sizes favor touch: contest-day users are on phones, often outdoors.

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "accent" | "go" | "danger" | "warn" | "ghost" }) {
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
        variant === "primary" && "bg-brand font-semibold text-brand-foreground hover:bg-brand-hover",
        variant === "secondary" && "border border-border bg-surface hover:border-brand/40 hover:bg-background",
        variant === "accent" && "bg-accent font-semibold text-accent-foreground hover:opacity-90",
        variant === "go" && "bg-success font-semibold text-success-foreground hover:opacity-90",
        variant === "warn" && "bg-danger font-semibold text-danger-foreground hover:opacity-90",
        variant === "danger" && "border border-danger bg-surface font-semibold text-danger hover:bg-danger/5",
        variant === "ghost" && "text-muted hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  "min-h-11 w-full rounded-sm border border-border bg-surface px-3 text-base outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/25";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "min-h-24 py-2", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6", className)} {...props} />;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "info" | "accent" | "brand" | "success" | "warning";
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-background text-muted ring-1 ring-border",
        tone === "info" && "bg-brand-soft text-foreground ring-1 ring-brand/25",
        tone === "accent" && "bg-accent-soft text-foreground ring-1 ring-accent/30",
        tone === "brand" && "bg-brand text-brand-foreground",
        tone === "success" && "bg-success-soft text-foreground ring-1 ring-success/30",
        tone === "warning" && "bg-warning-soft text-foreground ring-1 ring-warning/30",
      )}
    >
      {children}
    </span>
  );
}

export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm">
        {success}
      </p>
    );
  }
  return null;
}
