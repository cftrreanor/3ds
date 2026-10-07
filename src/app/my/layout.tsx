import { DemoBar } from "@/components/demo-bar";

export default function MyLayout({ children }: LayoutProps<"/my">) {
  return (
    <>
      <DemoBar />
      {children}
    </>
  );
}
