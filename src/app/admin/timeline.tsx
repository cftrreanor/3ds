import Link from "next/link";
import { ago, stamp, type TimelineItem } from "@/lib/admin-crm";
import { formatDate } from "@/lib/time";
import { Tag } from "./kit";
import { NoteControls } from "./note-controls";
import { deleteNote, setNoteDone } from "./notes-actions";

const KIND: Record<TimelineItem["kind"], { label: string; dot: string }> = {
  note: { label: "Note", dot: "bg-violet" },
  email: { label: "Email", dot: "bg-accent" },
  signin: { label: "Sign-in", dot: "bg-muted" },
  event: { label: "Event", dot: "bg-brand" },
  admin: { label: "Admin", dot: "bg-warning" },
  pipeline: { label: "Pipeline", dot: "bg-brand" },
  account: { label: "Account", dot: "bg-success" },
};

/** Everything that happened with an account or person, newest first. */
export function Timeline({ items, today }: { items: TimelineItem[]; today: string }) {
  if (items.length === 0) return <p className="px-3 py-6 text-center text-sm text-muted">Nothing yet.</p>;
  return (
    <ol className="divide-y divide-border">
      {items.map((it, i) => (
        <li key={`${it.kind}-${it.at}-${i}`} className="flex gap-3 px-3 py-2.5">
          <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${KIND[it.kind].dot}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className={`text-sm ${it.tone === "danger" ? "text-danger" : ""}`}>
                <span className="sr-only">{KIND[it.kind].label}: </span>
                {it.href ? (
                  <Link href={it.href} className="font-medium hover:underline">
                    {it.title}
                  </Link>
                ) : (
                  <span className="font-medium">{it.title}</span>
                )}
              </p>
              <time dateTime={it.at} title={stamp(it.at)} className="text-xs whitespace-nowrap text-muted">
                {ago(it.at)}
              </time>
            </div>
            {it.detail && (
              <p className={`mt-0.5 text-sm ${it.kind === "note" ? "whitespace-pre-line" : "text-muted"}`}>{it.detail}</p>
            )}
            {it.body && (
              <details className="mt-1 text-sm">
                <summary className="cursor-pointer text-xs font-semibold text-brand">Show the email</summary>
                <p className="mt-1 rounded-sm bg-background px-3 py-2 whitespace-pre-line">{it.body}</p>
              </details>
            )}
            {it.note && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {it.note.followUpOn && (
                  <Tag tone={it.note.done ? "success" : it.note.followUpOn <= today ? "warning" : "brand"}>
                    {it.note.done ? "Done" : "Follow up"} {formatDate(it.note.followUpOn, { year: undefined })}
                  </Tag>
                )}
                {it.note.author && <span className="text-xs text-muted">by {it.note.author}</span>}
                <NoteControls
                  followUp={Boolean(it.note.followUpOn)}
                  done={it.note.done}
                  toggle={setNoteDone.bind(null, it.note.id, !it.note.done)}
                  remove={deleteNote.bind(null, it.note.id)}
                />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Notes as timeline items. */
export function noteItems(
  notes: { id: string; body: string; follow_up_on: string | null; done_at: string | null; created_at: string; author: { full_name: string; email: string } | null }[],
): TimelineItem[] {
  return notes.map((n) => ({
    at: n.created_at,
    kind: "note",
    title: "Note",
    detail: n.body,
    note: { id: n.id, followUpOn: n.follow_up_on, done: Boolean(n.done_at), author: n.author?.full_name || n.author?.email || null },
  }));
}

/** Emails as timeline items (with the text, for ones written in the admin dashboard). */
export function emailItems(
  emails: { to_email: string; subject: string; status: string; error: string | null; created_at: string; body?: string | null; sender?: { full_name: string; email: string } | null }[],
  showTo = false,
): TimelineItem[] {
  return emails.map((e) => ({
    at: e.created_at,
    kind: "email",
    title: `${e.status === "sent" ? "Emailed" : e.status === "failed" ? "Email failed" : "Email not sent"}: ${e.subject}`,
    detail:
      [
        showTo || e.sender ? `To ${e.to_email}` : null,
        e.sender ? `by ${e.sender.full_name || e.sender.email}` : null,
        e.status !== "sent" ? e.error : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    body: e.body ?? null,
    tone: e.status === "sent" ? undefined : "danger",
  }));
}
