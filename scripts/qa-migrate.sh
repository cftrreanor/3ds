#!/usr/bin/env bash
# Brings the QA database up to date: runs each file in supabase/migrations
# that it hasn't run before, in order, and records it in qa_meta.applied_migrations.
# Run by .github/workflows/qa-database.yml (docs/QA-SETUP.md); QA_DATABASE_URL
# is the QA project's Session pooler connection string.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${QA_DATABASE_URL:?Set QA_DATABASE_URL to the QA database connection string}"

db() { psql "$QA_DATABASE_URL" -q -v ON_ERROR_STOP=1 "$@"; }

db -c "create schema if not exists qa_meta;
       create table if not exists qa_meta.applied_migrations (name text primary key, applied_at timestamptz not null default now());"
applied=$(db -At -c "select name from qa_meta.applied_migrations")

count=0
for f in supabase/migrations/*.sql; do
  name=$(basename "$f")
  grep -qxF "$name" <<<"$applied" && continue
  echo "Applying $name"
  db -f "$f"
  db -c "insert into qa_meta.applied_migrations (name) values ('$name')"
  count=$((count + 1))
done
echo "QA database is up to date ($count new)."
