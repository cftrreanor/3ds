import { downloadEventLogo } from "@/lib/event-brand";

/** The event's account logo, for its public pages. */
export async function GET(_request: Request, { params }: RouteContext<"/e/[slug]/logo">) {
  const logo = await downloadEventLogo((await params).slug);
  if (!logo) return new Response("No logo", { status: 404 });
  return new Response(logo.body, {
    headers: {
      "Content-Type": logo.type,
      // The address changes with each new logo (?v=), so it can be kept a while.
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
