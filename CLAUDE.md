@AGENTS.md

# Project notes
- Owner is non-technical: explain setup steps plainly, never ask them to paste secrets into chat.
- Privacy rules live in the database (supabase/migrations). Any change to RLS or the
  security-definer functions needs a matching case in supabase/tests/security_test.sql.
- Run `npm run lint && npm run typecheck && npm run build && npm run test:db` before pushing.
- Product name comes from src/lib/brand.ts only; don't hard-code it.
