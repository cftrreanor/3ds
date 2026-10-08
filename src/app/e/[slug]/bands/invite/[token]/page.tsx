import type { Metadata } from "next";
import Link from "next/link";
import { acceptBandInvite } from "@/app/dashboard/band-invite-actions";
import { ActionForm } from "@/components/action-form";
import { HeaderBar } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { findBandInvite } from "@/lib/band-invites";

export const metadata: Metadata = { title: "You're invited" };

/**
 * Where a band invitation email lands. One tap signs the director in and
 * opens registration with their saved band details. (A button rather than an
 * automatic sign-in, so email link checkers can't use up the link.)
 */
export default async function BandInvitePage({ params }: PageProps<"/e/[slug]/bands/invite/[token]">) {
  const { slug, token } = await params;
  const [invite, user] = await Promise.all([findBandInvite(token), getUser()]);
  const here = `/e/${slug}/bands`;
  const signedInAsInvitee = Boolean(invite && user && user.email.toLowerCase() === invite.email.toLowerCase());

  return (
    <>
      <HeaderBar maxWidth="max-w-md" href={`/e/${slug}`} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <Card>
          {!invite?.event || invite.event.slug !== slug ? (
            <>
              <h1 className="text-2xl font-bold">This link isn&apos;t valid</h1>
              <p className="mt-2 text-muted">It may have been replaced by a newer invitation.</p>
              <Link href={here} className="mt-4 inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline">
                Go to band registration
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted">You&apos;re invited</p>
              <h1 className="mt-1 text-3xl font-bold">{invite.event.name}</h1>
              {signedInAsInvitee || invite.usable ? (
                <>
                  <p className="mt-3 leading-7 text-muted">
                    Your band&apos;s details from last time are saved. Check them, change anything you need, and
                    register in one tap.
                  </p>
                  <ActionForm action={acceptBandInvite.bind(null, token)} className="mt-5">
                    <SubmitButton className="w-full" pendingText="Opening…">
                      {signedInAsInvitee ? "Review and register" : `Continue as ${invite.email}`}
                    </SubmitButton>
                  </ActionForm>
                  {!signedInAsInvitee && user && (
                    <p className="mt-3 text-sm text-muted">You&apos;re signed in as {user.email}; this switches to {invite.email}.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-3 leading-7 text-muted">
                    This invitation&apos;s sign-in link has already been used or has expired. Sign in with{" "}
                    <strong className="text-foreground">{invite.email}</strong> to register; your saved band details will be
                    there.
                  </p>
                  <Link
                    href={`/login?next=${encodeURIComponent(here)}&email=${encodeURIComponent(invite.email)}`}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                  >
                    Sign in to register
                  </Link>
                </>
              )}
            </>
          )}
        </Card>
      </main>
    </>
  );
}
