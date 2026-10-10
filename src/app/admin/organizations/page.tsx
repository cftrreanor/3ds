import { redirect } from "next/navigation";

/** Organizations are now "Accounts" in the admin CRM; old links still work. */
export default async function OrganizationsPage({ searchParams }: PageProps<"/admin/organizations">) {
  const { q } = await searchParams;
  redirect(typeof q === "string" && q ? `/admin/accounts?${new URLSearchParams({ q })}` : "/admin/accounts");
}
