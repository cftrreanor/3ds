import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

// The design system's faces: Inter for the interface, Barlow for headings,
// Barlow Condensed for page titles, JetBrains Mono for codes.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["500", "600", "700"] });
const barlowCondensed = Barlow_Condensed({ variable: "--font-barlow-condensed", subsets: ["latin"], weight: ["600", "700"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — band competition management`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Volunteer shifts, band registration, live performance order and announcements for marching band contests, in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
