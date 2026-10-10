import Link from "next/link";
import { Card } from "@/components/ui";
import { brand } from "@/lib/brand";

/** For people without a host invitation: how to become a host. */
export function HostingByInvitation({ email }: { email: string }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-semibold">Hosting is by invitation</h2>
      <p className="leading-7 text-muted">
        {brand.name} hosts are set up by our team. Request a pilot spot and we&apos;ll be in touch; once you&apos;re
        invited, sign in with <span className="font-medium text-foreground">{email}</span> to set up your organization.
      </p>
      <Link
        href="/#join"
        className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
      >
        Request a pilot spot
      </Link>
    </Card>
  );
}
