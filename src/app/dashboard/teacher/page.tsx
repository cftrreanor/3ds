import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getMyOrganization } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TeacherForm } from "./teacher-form";

export const metadata: Metadata = { title: "Your free teacher account" };

/** A teacher we've invited sets up their free account. Everyone else asks first, on the dashboard. */
export default async function TeacherSetupPage() {
  const user = await requireUser();
  if (await getMyOrganization()) redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: isAdmin }, { data: invited }] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase.rpc("has_host_invitation"),
  ]);
  if (!isAdmin && !invited) redirect("/dashboard");
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Set up your free teacher account</h1>
      <p className="mt-2 leading-7 text-muted">
        Free for parent-teacher conferences. Next, you&apos;ll pick your conference day and hours.
      </p>
      <Card className="mt-8">
        <TeacherForm name={profile?.full_name ?? ""} />
      </Card>
    </div>
  );
}
