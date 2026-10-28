import Link from "next/link";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasPass, readPass } from "@/lib/volunteer-pass";
import { headerLinkClass } from "./logo";

/**
 * The top-right links on public pages and My volunteering: "My events" for a
 * signed-in organizer, and "My volunteering" for anyone with sign-ups (on this
 * device, or with the account they're signed in with). Nothing for anyone else.
 */
export async function PublicNav({ current }: { current?: "volunteering" }) {
  const [user, pass] = await Promise.all([getUser(), readPass()]);
  let volunteers = current === "volunteering" || hasPass(pass);
  if (!volunteers && user) {
    const supabase = await createClient();
    const [{ data: shifts }, { data: items }] = await Promise.all([supabase.rpc("my_agenda"), supabase.rpc("my_items")]);
    volunteers = Boolean((shifts as unknown[] | null)?.length || (items as unknown[] | null)?.length);
  }
  if (!user && !volunteers) return null;
  return (
    <>
      {user && (
        <Link href="/dashboard" className={headerLinkClass}>
          My events
        </Link>
      )}
      {volunteers && (
        <Link
          href="/my"
          aria-current={current === "volunteering" ? "page" : undefined}
          className={`${headerLinkClass} aria-[current=page]:text-white aria-[current=page]:underline aria-[current=page]:underline-offset-8`}
        >
          My volunteering
        </Link>
      )}
    </>
  );
}
