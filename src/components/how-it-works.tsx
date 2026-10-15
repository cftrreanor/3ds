import { CardCarousel } from "@/components/card-carousel";
import { PhoneFrame } from "@/components/phone-frame";

/** One step: what happens, and a phone screenshot of it (public/screens/, sample data only). */
export type HowStep = { title: string; body: string; screen: string; alt: string };

// Most of a phone screen per step; all of them side by side on a wide one (the row's gap is 1.5rem).
const stepWidth = {
  3: "w-[75%] shrink-0 snap-start sm:w-[42%] lg:w-[calc((100%-3rem)/3)]",
  4: "w-[75%] shrink-0 snap-start sm:w-[42%] lg:w-[calc((100%-4.5rem)/4)]",
} as const;

/** "How it works": numbered steps, each with the real screen in a phone outline. `className` replaces the top border. */
export function HowItWorks({ steps, className = "border-t border-border" }: { steps: HowStep[]; className?: string }) {
  const width = stepWidth[steps.length === 3 ? 3 : 4];
  return (
    <section id="how" tabIndex={-1} className={`scroll-mt-20 outline-none ${className}`}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-normal leading-[1.02] tracking-tight sm:text-5xl">How it works</h2>
        <CardCarousel label="How it works, step by step" itemName="steps" ordered>
          {steps.map((s, i) => (
            <li key={s.title} className={`${width} flex flex-col`}>
              <div className="flex-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-semibold text-brand-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 leading-7 text-muted">{s.body}</p>
              </div>
              <PhoneFrame src={s.screen} alt={s.alt} className="mt-6 w-full max-w-[260px]" />
            </li>
          ))}
        </CardCarousel>
      </div>
    </section>
  );
}
