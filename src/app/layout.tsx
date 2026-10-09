import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono, Public_Sans } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

// The design system's faces: Public Sans for the interface, Barlow for headings,
// Barlow Condensed for page titles, JetBrains Mono for codes.
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["500", "600", "700"] });
const barlowCondensed = Barlow_Condensed({ variable: "--font-barlow-condensed", subsets: ["latin"], weight: ["600", "700"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — school event management`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Band contests, volunteer events and school visitor days in one place: sign-ups, registration, check-in on any phone and announcements, with privacy built in.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
