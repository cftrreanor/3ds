import "server-only";
import { getMyOrganization } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/**
 * The address lookup (Google Places) is billed per use, so only hosts (who
 * pick event venues) and FieldCommand admins may call it. Directors and
 * everyone else are turned away.
 */
export async function canUsePlaces(): Promise<boolean> {
  if (await getMyOrganization()) return true;
  const supabase = await createClient();
  return (await supabase.rpc("is_platform_admin")).data === true;
}
