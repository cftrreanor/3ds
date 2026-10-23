import { NextResponse, type NextRequest } from "next/server";
import { QA_COOKIE, isQa, qaOpenPath, reviewerFromCookie } from "@/lib/qa";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // The QA site is for reviewers only (src/lib/qa.ts): everyone else gets the
  // passcode page, and nothing on it is listed by search engines.
  if (isQa()) {
    const { pathname, search } = request.nextUrl;
    if (!qaOpenPath(pathname) && !reviewerFromCookie(request.cookies.get(QA_COOKIE)?.value)) {
      const url = request.nextUrl.clone();
      url.pathname = "/qa/login";
      url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
      return noIndex(NextResponse.redirect(url));
    }
    return noIndex(await route(request));
  }
  return route(request);
}

async function route(request: NextRequest) {
  // If Supabase doesn't recognize our callback address it falls back to the
  // home page, with the sign-in code attached. Finish signing in anyway.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== "/auth/callback" && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }
  return updateSession(request);
}

function noIndex(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Skip static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
