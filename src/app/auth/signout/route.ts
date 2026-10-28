import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const form = await request.formData().catch(() => null);
  // This device unless they chose "All devices": other windows and devices otherwise stay signed in.
  await supabase.auth.signOut({ scope: form?.get("scope") === "global" ? "global" : "local" });
  const target = safeNext(form?.get("next")) ?? "/";
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), { status: 303 });
}
