import { RecordLink } from "../kit";

export type FollowUpRow = {
  id: string;
  body: string;
  follow_up_on: string;
  done_at: string | null;
  created_at: string;
  organization: { id: string; name: string } | null;
  person: { id: string; full_name: string; email: string } | null;
  request: { id: string; organization: string } | null;
  author: { full_name: string; email: string } | null;
};

export const FOLLOW_UP_COLUMNS =
  "id, body, follow_up_on, done_at, created_at, organization:organizations(id, name), person:profiles!admin_notes_profile_id_fkey(id, full_name, email), request:pilot_requests(id, organization), author:profiles!admin_notes_author_id_fkey(full_name, email)";

/** Who a follow-up is about, as a link. */
export function FollowUpSubject({ f }: { f: FollowUpRow }) {
  if (f.organization) return <RecordLink href={`/admin/accounts/${f.organization.id}`}>{f.organization.name}</RecordLink>;
  if (f.person) return <RecordLink href={`/admin/people/${f.person.id}`}>{f.person.full_name || f.person.email}</RecordLink>;
  if (f.request) return <RecordLink href={`/admin/pipeline/${f.request.id}`}>{f.request.organization}</RecordLink>;
  return <span className="text-muted">—</span>;
}
