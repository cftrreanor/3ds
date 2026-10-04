# PRD review: stakeholder notes

Review of *BandCamp.com 10/4/26 PRD* (now named **FieldCommand**).
It's a strong PRD: the problems are real, the personas are specific, and a few ideas
are better than what competitors ship. Below: what to keep, what has to change, and
what's still open.

---

## Keep these (good calls)

1. **Time-gated contact details for Section Leads.** This sets the product apart.
   Parents worry about where their phone numbers end up, and this answers that.
   I built it into the database itself, not only the website (see "What's built").
2. **Name + email + phone signup with no password.** Every extra field costs you
   volunteers. Volunteers sign in later with an emailed link.
3. **Performance order hidden until the host publishes it.** Correct, and it heads
   off a lot of "why are we last?" emails.
4. **Counts only, never student names.** Collecting student-level data would bring
   in FERPA/COPPA obligations and district data-privacy agreements. Don't add it.
5. **Free for everyone except the host.** This removes friction where it matters.
6. **Atomic capacity locking (§6.3).** It's the right approach, and it's implemented.

## Must change

### 1. The name "BandCamp.com"
**Bandcamp** is a large, trademarked music platform, and "band camp" is also the
generic term for summer marching rehearsal. You would face a trademark dispute and
couldn't win search results. Pick a distinct name before buying a domain, making
a logo or approaching schools.

**Decided (Oct 2026): FieldCommand.** Still to do before launch: check the domain and
a USPTO trademark search. The name lives in one file (`src/lib/brand.ts`).

### 2. Roles must be per event, not one global role per user
The data dictionary gives each user a single `role`. In practice, a booster
president hosts their own contest in October and volunteers at a neighbor's
contest the week before. A band director might host one show and compete at
eight others. **Implemented:** organization admins (hosts), plus Volunteer
Directors and Section Leads assigned per event.

### 3. The customer is an organization, not a person
Booster presidents change every year. If the $250 subscription belongs to one
person's login, it leaves with them. **Implemented:** `organizations` own events
and the subscription, and several hosts can belong to one organization.

### 4. Missing fields the PRD's own logic needs
- **Time zone** on events. The §6.2 pseudocode uses `event.timezone`, but the data
  dictionary never defines it. Without it, "midnight on event day" is wrong for
  everyone outside the server's time zone.
- **Multi-day events.** The vision mentions them, but `event_date` is a single date.
  → `starts_on` / `ends_on`.
- **Performance and warm-up *times*.** `performance_order` is an integer, but
  directors and parents need clock times. → `performance_slots` with
  `warm_up_at`, `perform_at`, `warm_up_location`.
- **Multi-select audiences.** §4.4 describes a multi-select picker, but the table
  stores a single enum. → an array.

### 5. Don't hard-code Texas
"UIL classification" and the 25-chaperone cap are Texas/UIL rules. Make them
per-event settings with Texas defaults so you can sell beyond Texas.
**Implemented:** `classifications` and `chaperone_limit` are settings on each event.

### 6. SMS is not "included" at $250/year without a plan
Texting in the US now requires carrier registration (A2P 10DLC). Expect a few
weeks of approval plus monthly fees, and every message costs money. Also, spectators
have no login, so you have no phone numbers to text them.
**Recommendation:** for v1, deliver emergency alerts through the live web dashboards,
email, and a public alert banner. Add SMS in v2 as an add-on or with a per-event
message allowance, and only for people who opted in (volunteers, staff, directors).

### 7. Simplify the stack
§6.4 lists Redis + Celery/BullMQ workers, Twilio and SendGrid. With Supabase +
Vercel you don't need a separate job server for v1:
- Live dashboard updates → **Supabase Realtime** (built in).
- Emails → **Resend** (simpler than SendGrid, generous free tier).
- **The public spectator page should *not* use a live connection per phone.**
  A stadium of 3,000 parents would exceed realtime connection limits. It refreshes
  from a cached endpoint every ~20 seconds, which is cheap and holds up under load.

## Opportunities (not in the PRD, worth considering)

- **Collect band entry fees through the platform.** Most contests charge each band
  $300–$600. With Stripe Connect, hosts could get paid inside the band registration
  flow, and you could keep a small fee. That could earn more than the $250 license.
  Phase 2.
- **Schools pay by purchase order, not credit card.** Stripe Invoicing handles
  "send me an invoice" (net-30). Plan for it so you don't lose sales to paperwork.
- **Pricing check.** Most boosters host one contest a year, so "unlimited events"
  works out to $250 per event. That's cheap compared with the hours it saves. Consider
  a free **pilot** with 2–3 friendly contests this season in exchange for feedback
  and testimonials, then set the price.

## Open questions for you

1. **When is the first real event you want to run on this?** Marching season is
   happening now. Fall 2026 is realistic for a small pilot only if a contest falls in
   late October or November. Otherwise target spring events (concert/solo &
   ensemble) or the Fall 2027 season, which is what I'd recommend.
2. **Do you have a pilot host lined up?** Building alongside one real booster club
   is the biggest single risk reducer.
3. ~~The real product name?~~ FieldCommand.
4. **Sell beyond Texas from the start?** (affects onboarding wording)
