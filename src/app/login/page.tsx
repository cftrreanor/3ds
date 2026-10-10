import type { Metadata } from "next";
import { HeaderBar } from "@/components/logo";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next, email, sent } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  if (isSupabaseConfigured && (await getUser())) redirect(safeNext ?? "/dashboard");

  return (
    <>
    <HeaderBar maxWidth="max-w-md" />
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="mb-6 text-2xl font-medium">Sign in</h1>
          {isSupabaseConfigured ? (
            <LoginForm
              linkError={error === "link"}
              next={safeNext}
              email={typeof email === "string" ? email : undefined}
              sentTo={sent === "1" && typeof email === "string" ? email : undefined}
            />
          ) : (
            <p className="text-muted">Sign-in isn&apos;t available yet: the database connection is not set up.</p>
          )}
        </Card>
      </div>
    </main>
    </>
  );
}
