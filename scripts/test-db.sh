#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres database and runs the
# security tests. Needs a local Postgres (psql) you can connect to; set
# PGHOST/PGUSER/etc. if it isn't the default.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="event_shell_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/security_test.sql
