-- =============================================================================
-- Comments on the QA site's pages (docs/QA-SETUP.md).
--
-- Reviewers click a spot on any QA page and leave a comment. Each one keeps
-- who wrote it, the page, where on the page, who they were viewing as, their
-- screen size, and a screenshot; replies and resolving follow. Each comment
-- also becomes a GitHub issue (github_issue), so changes can be tracked there.
--
-- Only the server reads or writes these (its own key). The live site never
-- uses them.
-- =============================================================================

create table public.qa_comments (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  author        text not null,
  body          text not null check (char_length(body) between 1 and 4000),
  -- The page, as a path ("/e/fall-conferences/book"), and where on it.
  path          text not null,
  anchor        jsonb not null default '{}',
  viewing_as    text,
  screen        text,
  -- What the reviewer saw, as a JPEG data URL, with the spot circled.
  screenshot    text,
  status        text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by   text,
  resolved_at   timestamptz,
  github_issue  int
);
create index qa_comments_path on public.qa_comments (path, created_at);
create index qa_comments_created_at on public.qa_comments (created_at desc);

create table public.qa_comment_replies (
  id              uuid primary key default gen_random_uuid(),
  comment_id      uuid not null references public.qa_comments (id) on delete cascade,
  created_at      timestamptz not null default now(),
  author          text not null,
  body            text not null check (char_length(body) between 1 and 4000),
  github_comment  bigint
);
create index qa_comment_replies_comment on public.qa_comment_replies (comment_id, created_at);

alter table public.qa_comments enable row level security;
alter table public.qa_comment_replies enable row level security;
revoke all on public.qa_comments, public.qa_comment_replies from anon, authenticated;
grant select, insert, update, delete on public.qa_comments, public.qa_comment_replies to service_role;
