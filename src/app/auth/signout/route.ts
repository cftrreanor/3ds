import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const form = await request.formData().catch(() => null);
  const target = safeNext(form?.get("next")) ?? "/";
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), { status: 303 });
}
