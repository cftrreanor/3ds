import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where sign-in emails land. Handles both link styles Supabase can send:
//   ?code=…                    (default; must be opened in the same browser)
//   ?token_hash=…&type=email   (our custom email template; works on any device)
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  // Where to go afterwards: ?next=, or the page remembered when the link was requested.
  const next = safeNext(url.searchParams.get("next") ?? request.cookies.get("fc_next")?.value ?? null);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  const response = NextResponse.redirect(new URL(ok ? next : "/login?error=link", url.origin));
  if (ok) response.cookies.delete("fc_next");
  return response;
}

/** Only allow redirects within this site. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}
