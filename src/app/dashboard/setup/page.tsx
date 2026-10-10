import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { HostingByInvitation } from "@/components/hosting-by-invitation";
import { requireUser } from "@/lib/auth";
import { getMyOrganization } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "../onboarding-form";

export const metadata: Metadata = { title: "Set up your organization" };

export default async function SetupPage() {
  const user = await requireUser();
  if (await getMyOrganization()) redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: isAdmin }, { data: invited }] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase.rpc("has_host_invitation"),
  ]);
  if (!isAdmin && !invited) {
    return (
      <div className="mx-auto max-w-lg">
        <HostingByInvitation email={user.email} />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Set up your organization</h1>
      <p className="mt-2 leading-7 text-muted">
        This is the group that hosts your contest. You can invite other organizers later.
      </p>
      <Card className="mt-8">
        <OnboardingForm />
      </Card>
    </div>
  );
}
