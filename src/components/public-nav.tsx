import Link from "next/link";
import { getUser } from "@/lib/auth";
import { hasUpcomingVolunteering } from "@/lib/my-volunteering";
import { headerLinkClass } from "./logo";

/**
 * The top-right links on public pages and My volunteering: "My events" for a
 * signed-in organizer, and "My volunteering" for anyone with volunteering still
 * to come (on this device, or with the account they're signed in with).
 * Nothing for anyone else.
 */
export async function PublicNav({ current }: { current?: "volunteering" }) {
  const user = await getUser();
  const volunteers = current === "volunteering" || (await hasUpcomingVolunteering(Boolean(user)));
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
