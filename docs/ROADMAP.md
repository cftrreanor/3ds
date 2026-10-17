# Roadmap

Each step ends with something you can show a real school, PTO, or booster club.
Last updated October 2026.

## Built

**Foundation**
- Website and app (Next.js on Vercel), database and sign-in (Supabase)
- Privacy rules enforced inside the database, with automated security tests for every rule
- Emails from fieldcommandevents.com (Resend), with calendar invites that update themselves

**Accounts and teams**
- Sign in with an emailed link (or a password)
- Organizations by invitation; free self-serve teacher accounts for conferences
- Teams per event: Hosts and Co-hosts, Volunteer Leads, Section Leads, Station Coordinators
- Demo mode for showing any event type as any role

**Kinds of event**
- **Volunteer events:** stations and shifts set up step by step; public sign-up with no account
  (including family members and under-18 helpers); confirmations, calendar invites, and
  day-before reminders; "My shifts"; check-in desk with walk-ups; Section Lead rosters
- **Band contests:** director registration with saved details; performance order and finals
  (with a finalist reveal); contest-day check-in stations from parking to the gate; push the
  schedule back; live order for spectators; each director's contest-day card
- **Choir and group festivals:** rooms and a schedule builder; Arrived / Done taps on the day;
  directors and families follow each room live
- **School fairs and fundraisers:** booths and partners by zone, partner check-in, a public
  "What's at the event" page
- **Parent and visitor check-in:** registration with each child, teacher, and grade; photo ID
  reminders; door check-in; details deleted 30 days after
- **Parent-teacher conferences:** meeting times and breaks; families book, change, or cancel from
  their own link; reminders; the teacher's meetings page with Met / No-show, a printable summary,
  and cancel-with-email
- Spreadsheet import for bands, volunteers, and parents

**Communication**
- Event banners for day-of messages (delays, band switches, emergencies)
- Company banners from the admin dashboard
- File sharing (maps, packets) with exactly the people who need them

**Admin dashboard**
- A CRM for the pilot: pipeline, accounts, people, private notes and follow-ups, email templates,
  sign-in history
- Teacher accounts: upgrade to a full account, or suspend

**Privacy, security, and reliability**
- Deletion schedule run by the daily job (volunteers 10 days after, children's details 30 days
  after, and more)
- Penetration test and fixes (October 2026, docs/SECURITY-REVIEW-2026-10.md)
- Error alerts (Sentry), with no personal details sent
- Bot protection on public forms (Cloudflare Turnstile), on once its keys are added
- Reminders that printed and copied information is the school's or organization's record

**Website**
- Homepage and a page for each kind of event, each with "How it works" screenshots
- Parent-teacher conferences page with "Free for teachers"
- Copy follows the brand voice (docs/brand-voice.md)

## Next
1. **Privacy policy and terms of service pages**, once the attorney's review is done; swap the
   attorney's wording into the school-records reminders (src/lib/records.ts)
2. **Turn on bot protection:** add the Cloudflare keys (docs/SETUP-GUIDE.md)
3. **Administrators page**, then bring back the homepage's "For administrators" card
4. **Event-day messages, upgraded:** choose who gets each announcement; emergency alerts by email too
5. **Pages that update on their own** (schedules, check-in) without reloading

## Before the pilot ends
- **Stripe** subscription checkout and invoices for purchase orders (set up the business entity
  and bank account first)
- A ready answer for district **data privacy agreements** (for example, the Texas Student
  Privacy Alliance template)
- Optional: **PostHog** product analytics; Sentry's source maps for readable alerts

## Later
- Text-message alerts (needs A2P 10DLC carrier registration)
- Band entry-fee payments (Stripe Connect)
- Season dashboards, spreadsheet exports, and waitlists
- Only if testers ask: a "your conference summary is ready" email with a link (no names in the
  email); "Connect Zoom" / Google Meet so each family gets its own meeting link

## Decisions made
- **No built-in video.** Teachers paste their own Zoom or Meet link. "Connect Zoom" is the next
  step only if testers ask.
- **"Host" stays** the in-app name for the account permission level; the website says "organizer".
- **Conference summaries are print or save-as-PDF**, never emailed with children's names, so the
  30-day deletion promise holds for what's in the app.
- **Kept as is after the security review:** sign-in links that work on any device; "already
  registered" messages on public forms; no per-person limit on the address search (a $5 Google
  budget alert is the safety net).
