import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getMyOrganization } from "@/lib/data";
import { OnboardingForm } from "../onboarding-form";

export const metadata: Metadata = { title: "Set up your organization" };

export default async function SetupPage() {
  if (await getMyOrganization()) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Set up your organization</h1>
      <p className="mt-2 leading-7 text-muted">
        This is the group that hosts your contest. You can invite other organizers later.
      </p>
      <Card className="mt-8">
        <OnboardingForm />
      </Card>
    </div>
  );
}
