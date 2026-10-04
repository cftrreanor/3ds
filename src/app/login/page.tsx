import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next, email } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  if (isSupabaseConfigured && (await getUser())) redirect(safeNext ?? "/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold">
          <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-accent" />
          {brand.name}
        </Link>
        <Card>
          <h1 className="mb-6 text-xl font-semibold">Sign in</h1>
          {isSupabaseConfigured ? (
            <LoginForm
              linkError={error === "link"}
              next={safeNext}
              email={typeof email === "string" ? email : undefined}
            />
          ) : (
            <p className="text-muted">Sign-in isn&apos;t available yet: the database connection is not set up.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
