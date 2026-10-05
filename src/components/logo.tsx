import Image from "next/image";
import Link from "next/link";
import { brand } from "@/lib/brand";

/** The FieldCommand Events logo. It's white, so always place it on the dark header bar. */
export function Logo({ href = "/", className = "h-11 w-auto sm:h-12" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
      <Image src="/logo.png" alt={`${brand.name} Events`} width={260} height={160} priority className={className} />
    </Link>
  );
}

/** Dark bar across the top of a page with the logo, plus optional links on the right. */
export function HeaderBar({
  href = "/",
  maxWidth = "max-w-5xl",
  children,
}: {
  href?: string;
  maxWidth?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="bg-header text-header-foreground">
      <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-3 px-4 py-2.5 sm:px-6`}>
        <Logo href={href} />
        {children && <div className="flex items-center gap-1 text-sm sm:gap-2">{children}</div>}
      </div>
    </header>
  );
}

/** Link styling for use inside the header bar. */
export const headerLinkClass =
  "min-h-11 content-center whitespace-nowrap rounded-md px-2 text-white/80 hover:text-white sm:px-3";
