import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

// The design system's faces: Inter (variable, so the in-between 460/540 weights
// render) for everything, JetBrains Mono for codes.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
