import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { brand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";
import { Toaster } from "@/components/toaster";
import { RequiredFields } from "@/components/required-fields";
import { QaBar } from "@/components/qa-bar";
import { VisitCounter } from "@/components/visit-counter";

// The design system's faces: Inter (variable, so the in-between 460/540 weights
// render) for everything, JetBrains Mono for codes.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

const DESCRIPTION =
  "Every detail organized. Every organizer supported. Band contests, choir festivals, school fairs and fundraisers, volunteer events, parent check-in, and parent-teacher conferences, with registration, volunteer sign-ups, and check-in on any phone.";

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
        <QaBar />
        <VisitCounter />
        {children}
        <Toaster />
        <RequiredFields />
      </body>
    </html>
  );
}
