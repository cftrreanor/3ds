import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin";
import { ago, stamp } from "@/lib/admin-crm";
import { brand } from "@/lib/brand";
import { sampleVars, systemEmail } from "@/lib/system-emails";
import { PageHeader } from "../../kit";
import { resetSystemEmail, saveSystemEmail } from "../actions";
import { loadSavedSystemEmails } from "../data";
import { SystemEmailEditor } from "./editor";

export async function generateMetadata({ params }: PageProps<"/admin/emails/[key]">): Promise<Metadata> {
  return { title: systemEmail((await params).key)?.name ?? "System email" };
}

/** One system email: its words, a live preview, Save, Send me a test, and Reset to original. */
export default async function SystemEmailPage({ params }: PageProps<"/admin/emails/[key]">) {
  await requirePlatformAdmin();
  const { key } = await params;
  // The list of emails lives in the code, so an unknown key is a wrong address, not a missing update.
  const email = systemEmail(key);
  if (!email) notFound();
  const saved = (await loadSavedSystemEmails()).get(key);

  return (
    <div className="space-y-4">
      <PageHeader
        title={email.name}
        sub={
          <>
            {email.description}{" "}
            {saved ? (
              <span title={stamp(saved.updated_at)}>
                Edited {ago(saved.updated_at)}
                {saved.editor?.full_name ? ` by ${saved.editor.full_name}` : ""}.
              </span>
            ) : (
              "It uses the original wording."
            )}
          </>
        }
        actions={
          <Link href="/admin/emails" className="text-sm text-muted hover:text-foreground">
            All system emails
          </Link>
        }
      />
      <SystemEmailEditor
        key={saved?.updated_at ?? "original"}
        email={email}
        initial={saved ?? email.starting}
        edited={Boolean(saved)}
        samples={sampleVars(email, brand.name)}
        action={saveSystemEmail.bind(null, key)}
        onReset={resetSystemEmail.bind(null, key)}
      />
    </div>
  );
}
