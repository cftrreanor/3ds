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
- Event-day pages that update on their own: every 10 seconds on check-in screens, right away when a
  phone wakes up, with "Updated just now" and a clear note when there's no connection
- Event banners for day-of messages (delays, band switches, emergencies), each to the groups you
  choose; emergencies are emailed right away too
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
- Bot protection on public forms (Cloudflare Turnstile)
- Reminders that printed and copied information is the school's or organization's record

**Website**
- Homepage and a page for each kind of event, each with "How it works" screenshots
- Parent-teacher conferences page with "Free for teachers"
- A page for principals and district administrators, with its card on the homepage
- A Student data privacy page for districts, and a district packet with draft Texas agreement exhibits
  (docs/DATA-PRIVACY.md)
- Copy follows the brand voice (docs/brand-voice.md)

## Next
1. **Privacy policy and terms of service pages**, once the attorney's review is done; swap the
   attorney's wording into the school-records reminders (src/lib/records.ts)

## Before the pilot ends
- **Stripe** subscription checkout and invoices for purchase orders (set up the business entity
  and bank account first)
- **Data privacy agreements:** attorney review of docs/DATA-PRIVACY.md (district packet and draft
  Texas agreement exhibits), then close its "Before signing" list
- Optional: **PostHog** product analytics; Sentry's source maps for readable alerts

## Later
- **Teacher free and Teacher paid accounts.** Free: one published conference at a time (today's
  pilot rule). Paid: more than one at a time, priced for a single teacher. Needs Stripe (above), a
  "Teacher paid" plan the database rule checks instead of "one per account", and the event page's
  "one at a time" note changed to offer the upgrade instead of "write to us"
- Emergency alerts by text message (needs carrier registration with the business's tax ID, people's
  consent at sign-up, and about $2 to $12 a month plus about 1¢ a text)
- Band entry-fee payments (Stripe Connect)
- Season dashboards, spreadsheet exports, and waitlists
- Instant (within a second) updates for event-team screens with Supabase live updates, if the
  10-second refresh isn't fast enough
- Only if testers ask: a "your conference summary is ready" email with a link (no names in the
  email); "Connect Zoom" / Google Meet so each family gets its own meeting link

## Decisions made
- **No built-in video.** Teachers paste their own Zoom or Meet link. "Connect Zoom" is the next
  step only if testers ask.
- **"Host" stays** the in-app name for the account permission level; the website says "organizer".
- **Conference summaries are print or save-as-PDF**, never emailed with children's names, so the
  30-day deletion promise holds for what's in the app.
- **The pilot ends January 1, 2027** (Oct 2026), for every pilot account: the site says so, and a
  new pilot's free period ends that day by default (`PILOT_END` in src/lib/pilot.ts).
- **One published conference at a time during the pilot** (Oct 2026), for every account. The app
  says so before Publish, names the conference that's already up, and offers "write to us" for
  more. Upgrading isn't offered yet: the Teacher free / Teacher paid split above comes first.
- **Kept as is after the security review:** sign-in links that work on any device; "already
  registered" messages on public forms; no per-person limit on the address search (a $5 Google
  budget alert is the safety net).
