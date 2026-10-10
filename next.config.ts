import type { NextConfig } from "next";

// Security headers on every page:
// - Never shown inside another site's frame (stops "clickjacking": a page that
//   overlays our buttons to trick a signed-in host into clicking them).
// - Other sites only learn our domain, not full page addresses, from links.
// - Browsers don't guess file types; no camera, microphone or location.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
