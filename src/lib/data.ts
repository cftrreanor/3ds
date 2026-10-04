import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  default_timezone: string;
  subscription_status: string;
};

/** The first organization the signed-in user administers (multi-org comes later). */
export async function getMyOrganization(): Promise<Organization | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, slug, default_timezone, subscription_status")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data;
}
