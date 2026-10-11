import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Search engines read the homepage and public event pages; everything behind
// a sign-in, plus private links (passes, files, invitations), stays out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/my", "/api", "/auth", "/login", "/invite", "/pass", "/files", "/cal", "/update-needed"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
