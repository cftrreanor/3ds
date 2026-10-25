import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv, type HistoryRow } from "@/lib/volunteer-history-csv";

// The account's volunteer history as a spreadsheet. Every package can download
// it, even one without volunteer tracking (volunteer_history_export checks the
// person is a host or Volunteer Lead).
export async function GET(request: NextRequest) {
  const account = request.nextUrl.searchParams.get("account") ?? "";
  if (!(await getUser())) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(`/dashboard/volunteer-tracking/download?account=${account}`)}`, request.nextUrl.origin),
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(account)) return new NextResponse("Pick an account.", { status: 404 });
  const { data, error } = await (await createClient()).rpc("volunteer_history_export", { p_org: account });
  if (error) {
    if (error.code !== "42501") console.error("volunteer_history_export failed", error.message);
    return new NextResponse("You can't download this account's volunteer history.", { status: 404 });
  }
  const rows = ((data ?? []) as HistoryRow[]).map((r) => ({ ...r, email: r.email.toLowerCase() }));
  rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="volunteer-history.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
