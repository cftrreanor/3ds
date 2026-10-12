import Image from "next/image";

/**
 * A screenshot inside a simple phone outline (with a lighter edge in dark
 * mode, so it stands out from the dark page). Screenshots live in
 * public/screens/ (390×780 at 2×) and use made-up sample data only.
 */
export function PhoneFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rounded-[2rem] bg-header p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:p-2 dark:ring-2 dark:ring-field-border ${className}`}>
      <div className="overflow-hidden rounded-[1.6rem] bg-background">
        <Image src={src} alt={alt} width={780} height={1560} sizes="(min-width: 1024px) 260px, 45vw" className="h-auto w-full" />
      </div>
    </div>
  );
}
