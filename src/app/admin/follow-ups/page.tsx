import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_TZ, ago } from "@/lib/admin-crm";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { EmptyRow, PageHeader, Table, Tag, Td, Th, Tr } from "../kit";
import { NoteControls } from "../note-controls";
import { deleteNote, setNoteDone } from "../notes-actions";
import { FOLLOW_UP_COLUMNS, FollowUpSubject, type FollowUpRow } from "./shared";

export const metadata: Metadata = { title: "Follow-ups" };

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
] as const;

/** Every note with a follow-up date: what's due, what's coming, what's done. */
export default async function FollowUpsPage({ searchParams }: PageProps<"/admin/follow-ups">) {
  await requirePlatformAdmin();
  const { view } = await searchParams;
  const done = view === "done";
  const notes = () => createAdminClient().from("admin_notes").select(FOLLOW_UP_COLUMNS).not("follow_up_on", "is", null);
  const { data } = done
    ? await notes().not("done_at", "is", null).order("done_at", { ascending: false }).limit(100)
    : await notes().is("done_at", null).order("follow_up_on");
  const rows = (data ?? []) as unknown as FollowUpRow[];
  const today = utcToZonedDate(new Date().toISOString(), ADMIN_TZ);
  const due = rows.filter((r) => r.follow_up_on <= today).length;

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        sub={done ? "Finished follow-ups, most recent first." : `${rows.length} open · ${due} due today or overdue. Add one from any account, person or pilot request.`}
        actions={
          <nav aria-label="Follow-up views" className="flex rounded-sm border border-border text-sm">
            {VIEWS.map((v) => (
              <Link
                key={v.value}
                href={v.value === "open" ? "/admin/follow-ups" : "/admin/follow-ups?view=done"}
                aria-current={(v.value === "done") === done ? "page" : undefined}
                className={`px-3 py-1 ${(v.value === "done") === done ? "bg-brand text-brand-foreground" : "hover:bg-background"}`}
              >
                {v.label}
              </Link>
            ))}
          </nav>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Due</Th>
            <Th>About</Th>
            <Th>Note</Th>
            <Th>By</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const overdue = !f.done_at && f.follow_up_on < today;
            return (
              <Tr key={f.id}>
                <Td className="whitespace-nowrap">
                  <Tag tone={f.done_at ? "success" : overdue ? "danger" : f.follow_up_on === today ? "warning" : "neutral"}>
                    {f.follow_up_on === today ? "Today" : formatDate(f.follow_up_on, { year: undefined })}
                  </Tag>
                  {overdue && <p className="text-xs text-danger">Overdue</p>}
                  {f.done_at && <p className="text-xs text-muted">Done {ago(f.done_at)}</p>}
                </Td>
                <Td className="whitespace-nowrap">
                  <FollowUpSubject f={f} />
                </Td>
                <Td className="max-w-md whitespace-pre-line">{f.body}</Td>
                <Td className="whitespace-nowrap text-muted">{f.author?.full_name || f.author?.email || "—"}</Td>
                <Td className="text-right whitespace-nowrap">
                  <NoteControls followUp done={Boolean(f.done_at)} toggle={setNoteDone.bind(null, f.id, !f.done_at)} remove={deleteNote.bind(null, f.id)} />
                </Td>
              </Tr>
            );
          })}
          {rows.length === 0 && <EmptyRow cols={5}>{done ? "Nothing finished yet." : "No open follow-ups. Nice."}</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
