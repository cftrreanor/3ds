@AGENTS.md

# Project notes
- Owner is non-technical: explain setup steps plainly, never ask them to paste secrets into chat.
- Privacy rules live in the database (supabase/migrations). Any change to RLS or the
  security-definer functions needs a matching case in supabase/tests/security_test.sql.
- Run `npm run lint && npm run typecheck && npm run build && npm run test:db` before pushing.
- Product name comes from src/lib/brand.ts only; don't hard-code it.
- Number-only fields use `NumberInput` (src/components/number-input.tsx): a type-in box that
  accepts digits only. Never use `<input type="number">` (no up/down arrows).
- When a page's main data is missing, call `missing()` from src/lib/schema-check.ts, not
  `notFound()`: it shows "a database update is needed" when a migration hasn't been run yet.
