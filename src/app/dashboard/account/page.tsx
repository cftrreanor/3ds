import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { PasswordSection, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    // Fresh from Supabase, not the sign-in token, so a password saved a moment ago shows.
    supabase.auth.getUser(),
  ]);
  const hasPassword = !!auth.user?.user_metadata?.has_password;
  const mailto = <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-brand underline underline-offset-4">{brand.supportEmail}</a>;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Account</h1>
        <p className="mt-2 text-muted">
          Signed in as <strong className="font-semibold text-foreground">{user.email}</strong>
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">Need to change your email? Write to us at {mailto}.</p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Your details</h2>
        <ProfileForm fullName={profile?.full_name ?? ""} phone={formatPhone(profile?.phone)} />
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Password</h2>
        <PasswordSection hasPassword={hasPassword} email={user.email} name={profile?.full_name ?? ""} />
      </Card>

      <p className="text-sm leading-6 text-muted">
        Want your account closed? Write to us at {mailto} and we&apos;ll close it and remove your personal details.
      </p>
    </div>
  );
}
