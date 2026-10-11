import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";
import { Toaster } from "@/components/toaster";

// The design system's faces: Inter (variable, so the in-between 460/540 weights
// render) for everything, JetBrains Mono for codes.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

const DESCRIPTION =
  "School event management for band contests, choir festivals, school fairs and fundraisers, volunteer events and parent check-in. Registration, volunteer sign-ups and check-in on any phone, with privacy built in.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${brand.name}: Event Management Software for Schools, PTOs & Booster Clubs`,
    template: `%s · ${brand.name}`,
  },
  description: DESCRIPTION,
  applicationName: brand.name,
  openGraph: { type: "website", siteName: brand.name, description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
