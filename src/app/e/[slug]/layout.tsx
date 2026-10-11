import Link from "next/link";
import { DemoBar } from "@/components/demo-bar";
import { brand } from "@/lib/brand";

export default function EventPublicLayout({ children }: LayoutProps<"/e/[slug]">) {
  return (
    <>
      <DemoBar />
      {children}
      <footer className="mt-auto border-t border-border">
        <p className="mx-auto max-w-3xl px-4 py-6 text-center text-sm text-muted sm:px-6">
          Run with{" "}
          <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            {brand.name}
          </Link>
          : school event management for bands, choirs, PTOs and front offices.
        </p>
      </footer>
    </>
  );
}
