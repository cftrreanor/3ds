import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeaderBar } from "@/components/logo";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { EMAIL_LINK_DAYS, emailLinkCutoff } from "@/lib/email-link-age";
import { welcomeNext } from "@/lib/host-invite-link";
import { createAdminClient } from "@/lib/supabase/server";
import { signInFromHostInvite } from "./actions";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Set up your account" };

const linkClass = "font-medium text-brand underline-offset-4 hover:underline";

/**
 * Where the button in a host invitation email lands. It signs them in with
 * one tap (a POST, so email scanners that open links can't use it up) and
 * opens account setup. Old, replaced, or used links point to normal sign-in.
 */
export default async function WelcomePage({ params, searchParams }: PageProps<"/welcome/[id]">) {
  const { id } = await params;
  const { k, next: nextParam } = await searchParams;
  const key = typeof k === "string" && /^[0-9a-f-]{36}$/i.test(k) ? k : null;
  const next = welcomeNext(nextParam);
  const { data: inv } =
    key && /^[0-9a-f-]{36}$/i.test(id)
      ? await createAdminClient()
          .from("host_invitations")
          .select("email, expires_at, used_at, sent_at")
          .eq("id", id)
          .eq("email_token", key)
          .maybeSingle()
      : { data: null };
  const user = await getUser();
  if (inv && user && user.email.toLowerCase() === inv.email.toLowerCase()) redirect(next);

  const signIn = (email?: string) => `/login?${new URLSearchParams({ next, ...(email ? { email } : {}) })}`;
  const stale = inv && (!inv.sent_at || inv.sent_at < emailLinkCutoff());

  return (
    <>
      <HeaderBar maxWidth="max-w-md" />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <Card>
            {!inv ? (
              <>
                <h1 className="text-2xl font-medium">This link has been replaced</h1>
                <p className="mt-2 leading-7 text-muted">
                  Use the button in your newest invitation email, or{" "}
                  <Link href={signIn()} className={linkClass}>
                    sign in with your email address
                  </Link>
                  .
                </p>
              </>
            ) : inv.used_at ? (
              <>
                <h1 className="text-2xl font-medium">Your account is already set up</h1>
                <p className="mt-2 leading-7 text-muted">
                  <Link href={signIn(inv.email)} className={linkClass}>
                    Sign in with {inv.email}
                  </Link>{" "}
                  to continue.
                </p>
              </>
            ) : new Date(inv.expires_at) < new Date() ? (
              <>
                <h1 className="text-2xl font-medium">This invitation has expired</h1>
                <p className="mt-2 leading-7 text-muted">
                  Write to us at{" "}
                  <a href={`mailto:${brand.supportEmail}`} className={linkClass}>
                    {brand.supportEmail}
                  </a>{" "}
                  and we&apos;ll send a new one.
                </p>
              </>
            ) : stale ? (
              <>
                <h1 className="text-2xl font-medium">Sign in to set up your account</h1>
                <p className="mt-2 leading-7 text-muted">
                  For your security, the button in the email only works for {EMAIL_LINK_DAYS} days. Your invitation is still good:{" "}
                  <Link href={signIn(inv.email)} className={linkClass}>
                    sign in with {inv.email}
                  </Link>
                  , and we&apos;ll email you a sign-in link.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-medium">Welcome to {brand.name}</h1>
                <p className="mt-2 leading-7 text-muted">Your account is ready to set up.</p>
                <div className="mt-6">
                  <WelcomeForm action={signInFromHostInvite.bind(null, id, key!, next)} email={inv.email} />
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
