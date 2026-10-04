# Event Shell

A web platform for hosting marching band contests and other school competitions:
volunteer shifts, band registration, live performance order and announcements.

*"Event Shell" is a working title. See [docs/PRD-REVIEW.md](docs/PRD-REVIEW.md).*

## Docs
- [Setup guide](docs/SETUP-GUIDE.md): creating the accounts (start here)
- [PRD review](docs/PRD-REVIEW.md): decisions and open questions
- [Roadmap](docs/ROADMAP.md): what gets built, in what order

## Stack
- **Next.js** (App Router, TypeScript, Tailwind) on **Vercel**
- **Supabase**: Postgres, auth (magic links), realtime
- Later: Resend (email), Stripe (billing), Sentry (errors), PostHog (analytics)

## Project layout
```
src/app/                 pages
src/lib/supabase/        database clients (browser, server, admin)
src/proxy.ts             keeps login sessions fresh
supabase/migrations/     database schema + security rules
supabase/tests/          database security tests
docs/                    plain-English project docs
```

## Developing
```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev                  # http://localhost:3000
```

Checks:
```bash
npm run lint
npm run typecheck
npm run build
npm run test:db              # needs a local Postgres (psql/createdb on PATH)
```

## Security model (short version)
Privacy rules are enforced **in the database** with Row Level Security, so a bug in
a page can't leak data:
- Section Leads read their roster only through `station_roster()`, which hides
  phone and email except on the event's calendar day(s) in the event's time zone.
- Volunteer signup goes through `register_volunteer()`, which locks each shift row
  so the last slot can't be double-booked. It runs only from the server.
- Performance order lives in `performance_slots` and is hidden until published.
- Billing status can only be written by the server (Stripe webhook).
