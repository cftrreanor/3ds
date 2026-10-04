# Roadmap

Each phase ends with something you can show a real booster club.

## Phase 0: Foundation ✅ (done)
- Next.js website skeleton + landing page
- Full database design with privacy rules enforced in the database
- Automated tests proving: no overbooking, contacts locked until event day,
  directors can't see the performance order early, the public sees only public info

## Phase 1: Accounts & event setup ✅
- ✅ Sign in with emailed link (no passwords)
- ✅ Create an organization → create an event → stations → shifts
- ✅ "Fill the day" shift generator (e.g. 7 AM–10 PM in 3-hour blocks)
- ✅ Draft events are free; publishing will require a plan
- ✅ Edit event details (shifts move with a date change), stations and shifts
- ✅ Team: the host runs volunteers by default; optionally invite a separate
  Volunteer Director; invite Section Leads and assign them to stations
  (invite links are copied and sent by the host until automatic email is set up)

## Phase 2: Volunteers 🚧 (in review)
- ✅ Publish, open/close signup, share link + QR code
- ✅ Public signup page (bot traps; full shifts lock automatically)
- ✅ Confirmation email (Resend)
- ✅ "My shifts" agenda with lead contacts; volunteers can cancel
- ✅ Check-in console (phone-friendly, big tap targets)
- ✅ Section Lead roster on their station (contacts unlock on event day)
- ✅ No login needed: the signup device is remembered; a private link in the email
  works on any device; "Email me my link" for everything else
- ✅ Calendar invites in the confirmation email (+ Google / Apple / Outlook buttons);
  calendars update automatically when a shift moves and remove cancelled shifts
- ⏭ Reminder emails the day before; live updates without refreshing

## Phase 3: Bands & public view
- Band Director registration portal
- Host performance-order builder (drag to reorder, set times) + publish
- Public schedule page with live performance order and alert banner
- Active checkpoint queue (warm-up check-in/out)

## Phase 4: Broadcasts
- Announcement composer (audience multi-select, priority)
- Live alert pop-ups on dashboards; emergency alerts also by email

## Phase 5: Launch readiness
- **Stripe** subscription checkout + invoices for purchase orders
- **Sentry** error monitoring, **PostHog** product analytics
- Terms of service & privacy policy (have a lawyer review; you handle parent data)

## Later
- SMS alerts (requires A2P 10DLC registration)
- Band entry-fee payments via Stripe Connect
- Multi-event season dashboards, CSV exports, waitlists
