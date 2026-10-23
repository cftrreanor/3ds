import { cookies } from "next/headers";
import Link from "next/link";
import { switchReviewer } from "@/app/qa/actions";
import { QA_COOKIE, isQa, reviewerFromCookie } from "@/lib/qa";

/** Across the top of every QA page: it's test data, who's reviewing, and the outbox. Nothing elsewhere. */
export async function QaBar() {
  if (!isQa()) return null;
  const reviewer = reviewerFromCookie((await cookies()).get(QA_COOKIE)?.value);
  if (!reviewer) return null;
  return (
    <div className="bg-violet text-header print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <p className="font-semibold">QA site: test data, and emails go to the Outbox</p>
        <p className="sm:ml-auto">Reviewing as {reviewer}</p>
        <Link href="/qa/outbox" className="font-semibold underline underline-offset-2">
          Outbox
        </Link>
        <form action={switchReviewer}>
          <button type="submit" className="font-semibold underline underline-offset-2">
            Switch reviewer
          </button>
        </form>
      </div>
    </div>
  );
}
