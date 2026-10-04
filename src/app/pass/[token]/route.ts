import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { addToPass } from "@/lib/volunteer-pass";

// The "View my shifts" link from a volunteer's email. It's only ever sent to
// their inbox, so opening it proves they own the email: this browser is then
// remembered and can see and cancel that volunteer's shifts without logging in.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const { data } = await createAdminClient().from("volunteers").select("id").eq("access_token", token).maybeSingle();
    if (data) {
      await addToPass({ v: [token] });
      return NextResponse.redirect(new URL("/my", request.nextUrl.origin));
    }
  }
  return NextResponse.redirect(new URL("/my?link=invalid", request.nextUrl.origin));
}
