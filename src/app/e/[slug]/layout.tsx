import { DemoBar } from "@/components/demo-bar";

export default function EventPublicLayout({ children }: LayoutProps<"/e/[slug]">) {
  return (
    <>
      <DemoBar />
      {children}
    </>
  );
}
