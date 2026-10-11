/**
 * The site's public address, for search engines and link previews
 * (sitemap, robots, canonical links, structured data).
 */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://fieldcommandevents.com";
