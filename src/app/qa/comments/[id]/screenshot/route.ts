import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { QA_COOKIE, isQa, reviewerFromCookie } from "@/lib/qa";
import { createAdminClient } from "@/lib/supabase/server";

/** A QA comment's screenshot, for reviewers (src/app/qa/comment-actions.ts). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isQa() || !reviewerFromCookie((await cookies()).get(QA_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  const { data } = await createAdminClient().from("qa_comments").select("screenshot").eq("id", id).maybeSingle();
  const match = /^data:image\/jpeg;base64,(.+)$/.exec(data?.screenshot ?? "");
  if (!match) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(match[1], "base64"), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
  });
}
