"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Close a company banner for the signed-in person (the database refuses urgent ones). */
export async function dismissBanner(bannerId: string) {
  const user = await requireUser();
  const { error } = await (await createClient()).from("site_banner_dismissals").insert({ banner_id: bannerId, user_id: user.id });
  if (error && error.code !== "23505") console.error("dismissBanner failed", error.message);
  revalidatePath("/dashboard", "layout");
}
