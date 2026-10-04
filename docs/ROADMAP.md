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

## Phase 2: Volunteers
- Public signup page (with bot protection)
- Volunteer "My Agenda" dashboard
- Volunteer Director check-in console (phone-friendly, big tap targets)
- Section Lead station view (time-gated contacts)
- Confirmation + reminder emails (Resend)

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
