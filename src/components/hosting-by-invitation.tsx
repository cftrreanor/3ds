import Link from "next/link";
import { Card } from "@/components/ui";
import { brand } from "@/lib/brand";

/** For people without a host invitation: how to become a host, or start free as a teacher. */
export function HostingByInvitation({ email }: { email: string }) {
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">Organizer accounts are by invitation</h2>
        <p className="leading-7 text-muted">
          Our team sets up each {brand.name} organizer. Join the pilot and we&apos;ll be in touch. Once you&apos;re
          invited, sign in with <span className="font-medium text-foreground">{email}</span> to set up your organization.
        </p>
        <Link
          href="/#join"
          className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
        >
          Join the pilot
        </Link>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">Teacher? Parent-teacher conferences are free</h2>
        <p className="leading-7 text-muted">Set up a free teacher account and families book their own conference times.</p>
        <Link
          href="/dashboard/teacher"
          className="inline-flex min-h-11 items-center rounded-md border border-field-border px-4 text-sm font-semibold hover:border-brand"
        >
          Start free as a teacher
        </Link>
      </Card>
    </div>
  );
}
