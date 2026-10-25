import type { MetadataRoute } from "next";
import { ADMINISTRATORS_PAGE, AUDIENCES, CONFERENCES_PAGE, MEETINGS_PAGE, STUDENT_PRIVACY_PAGE } from "@/lib/audiences";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...[...AUDIENCES, CONFERENCES_PAGE, MEETINGS_PAGE, ADMINISTRATORS_PAGE, STUDENT_PRIVACY_PAGE].map((a) => ({ url: `${SITE_URL}${a.path}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
