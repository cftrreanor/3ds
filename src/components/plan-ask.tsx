import { brand } from "@/lib/brand";
import type { AccountHost } from "@/lib/plan";

/**
 * How to get a plan, for whoever is looking: the Account Host emails us, and
 * anyone else emails the Account Host. `kind` ("school fairs") goes in the
 * email's subject. A button in notices, a link in cards and notes.
 */
export function PlanAsk({
  host,
  orgName,
  kind,
  variant = "link",
}: {
  host: AccountHost;
  orgName: string;
  kind?: string;
  variant?: "button" | "link";
}) {
  const subject = encodeURIComponent(kind ? `A plan for ${orgName}: ${kind}` : `A plan for ${orgName}`);
  const buttonClass =
    "relative z-10 inline-flex min-h-11 items-center rounded-md border border-field-border bg-surface px-4 font-semibold text-foreground hover:border-brand";
  const linkClass = "relative z-10 font-medium text-brand underline underline-offset-4";
  const usLink = (
    <a href={`mailto:${brand.supportEmail}?subject=${subject}`} className={variant === "button" ? buttonClass : linkClass}>
      Email us about a plan
    </a>
  );
  if (host.isMe) {
    return variant === "button" ? (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {usLink}
        <span>
          <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand underline underline-offset-4">
            {brand.supportEmail}
          </a>{" "}
          · we reply within a day
        </span>
      </span>
    ) : (
      usLink
    );
  }
  if (host.unknown) {
    return (
      <span>
        Ask your Account Host about a plan, or email us at{" "}
        <a href={`mailto:${brand.supportEmail}?subject=${subject}`} className={linkClass}>
          {brand.supportEmail}
        </a>
        .
      </span>
    );
  }
  const named = host.name !== "your Account Host";
  if (!host.email) return <span className="font-medium">Ask {host.name}{named && ", your Account Host,"} about a plan.</span>;
  const href = `mailto:${host.email}?subject=${subject}`;
  return variant === "button" ? (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <a href={href} className={buttonClass}>
        Email {host.name} about a plan
      </a>
      <span>Your Account Host can get one for the account.</span>
    </span>
  ) : (
    <span>
      <a href={href} className={linkClass}>
        Email {host.name}
      </a>
      , your Account Host, about a plan.
    </span>
  );
}
