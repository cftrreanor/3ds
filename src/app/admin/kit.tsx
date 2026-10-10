import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { HEALTH_LABEL, type HealthLevel } from "@/lib/admin-crm";

// The admin CRM's own building blocks: denser and plainer than the customer
// app's cards (docs/DESIGN.md, "Admin"). Same tokens, same fonts.

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A bordered box with a small header bar. */
export function Panel({
  title,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={cx("rounded-md border border-border bg-surface", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
          {actions && <div className="text-xs">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-3"}>{children}</div>
    </section>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto rounded-md border border-border bg-surface", className)}>
      <table className="w-full border-collapse text-sm tabular-nums">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cx(
        "sticky top-0 border-b border-border bg-background px-3 py-2 text-left text-xs font-semibold whitespace-nowrap text-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** A column header that sorts the table through the page's search params. */
export function SortTh({
  label,
  name,
  sort,
  dir,
  params,
  className,
}: {
  label: string;
  name: string;
  sort: string;
  dir: string;
  params: Record<string, string>;
  className?: string;
}) {
  const active = sort === name;
  const next = active && dir === "asc" ? "desc" : "asc";
  const qs = new URLSearchParams({ ...params, sort: name, dir: next });
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={cx("sticky top-0 border-b border-border bg-background px-3 py-2 text-left text-xs font-semibold whitespace-nowrap", className)}
    >
      <Link href={`?${qs}`} className={cx("inline-flex items-center gap-1 hover:text-foreground", active ? "text-foreground" : "text-muted")}>
        {label}
        <span aria-hidden className="w-2 text-[10px]">
          {active ? (dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </Link>
    </th>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cx("border-b border-border last:border-b-0 hover:bg-background", className)}>{children}</tr>;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cx("px-3 py-2 align-top", className)} {...props} />;
}

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-6 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

const HEALTH_DOT: Record<HealthLevel, string> = {
  good: "bg-success",
  new: "bg-brand",
  watch: "bg-warning",
  risk: "bg-danger",
};

export function HealthPill({ level, title }: { level: HealthLevel; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span aria-hidden className={cx("size-2 rounded-full", HEALTH_DOT[level])} />
      {HEALTH_LABEL[level]}
    </span>
  );
}

/** A small, flat label: plan, stage, role. */
export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "success" | "warning" | "danger" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-sm px-1.5 py-px text-xs font-semibold whitespace-nowrap",
        tone === "neutral" && "bg-background text-muted ring-1 ring-border",
        tone === "brand" && "bg-brand-soft text-foreground ring-1 ring-brand/20",
        tone === "success" && "bg-success-soft text-foreground ring-1 ring-success/30",
        tone === "warning" && "bg-warning-soft text-foreground ring-1 ring-warning/30",
        tone === "danger" && "bg-danger/10 text-danger ring-1 ring-danger/30",
      )}
    >
      {children}
    </span>
  );
}

/** Label/value pairs for a record's side panel. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-brand">
      {children}
    </Link>
  );
}

/** Compact search box + filters row. A GET form, so filters live in the address. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form role="search" className="mb-3 flex flex-wrap items-center gap-2">
      {children}
      <button className="h-8 rounded-sm border border-border bg-surface px-3 text-sm font-semibold hover:bg-background">Apply</button>
    </form>
  );
}

export const smallInput =
  "h-8 rounded-sm border border-border bg-surface px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

export const smallButton =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-semibold disabled:opacity-50";
export const primarySmall = `${smallButton} bg-brand text-brand-foreground hover:bg-brand-hover`;
export const secondarySmall = `${smallButton} border border-border bg-surface hover:bg-background`;
