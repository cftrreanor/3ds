"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QA_COOKIE } from "@/lib/qa";
import { createClient } from "@/lib/supabase/server";

/** Hand the QA site to another reviewer: forget who's reviewing and sign out. */
export async function switchReviewer(): Promise<void> {
  await (await createClient()).auth.signOut({ scope: "local" });
  (await cookies()).delete(QA_COOKIE);
  redirect("/qa/login");
}
