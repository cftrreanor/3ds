import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Account</h1>
        <p className="mt-1 text-muted">{user.email}</p>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Your details</h2>
        <ProfileForm fullName={profile?.full_name ?? ""} phone={formatPhone(profile?.phone)} />
      </Card>

      <Card>
        <h2 className="font-semibold">Password</h2>
        <p className="mt-1 mb-4 text-sm leading-6 text-muted">
          Optional. With a password you can sign in without waiting for an email. Email links keep working
          too.
        </p>
        <PasswordForm />
      </Card>
    </div>
  );
}
