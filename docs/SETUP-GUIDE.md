# Setup guide (no coding needed)

Do these in order. **Only steps 1–4 are needed now.** The rest come later, and
there's no reason to pay for anything yet: every service below has a free tier
that covers building and piloting.

Use one email address for all of them, ideally a new one for the business
(e.g. a free Gmail like `yourproduct.team@gmail.com`), so you can hand the business
off or bring in help later without sharing your personal inbox.

> 🔒 **Golden rule for keys and passwords:** never paste a *secret* key into a chat,
> email, or GitHub. When I need one in the project, you'll put it into Vercel's
> settings screen yourself.

---

## 1. GitHub: where the code lives ✅ already done
You already have an account (`cftrreanor`) and a repository (`3ds`). That's where
I'm saving the code.
- Turn on two-factor authentication: GitHub → your photo (top right) → **Settings →
  Password and authentication → Enable two-factor authentication**.
- Optional: rename the repo once you pick a product name (**Settings → General →
  Repository name**). Tell me if you do.

## 2. Supabase: the database and logins
1. Go to **supabase.com** → **Start your project** → **Continue with GitHub**.
2. **New project**:
   - Name: `fieldcommand`
   - Database password: click **Generate**, then **save it in a password manager**
   - Region: **East US** or **Central US** (closest to Texas)
   - Plan: **Free**
3. Wait ~2 minutes for it to finish.
4. Go to **Project Settings → API Keys** and keep the tab open for step 4.

5. **Load the database design:**
   - On GitHub, open `supabase/migrations/` and click the `.sql` file inside.
   - Click the **Copy raw file** button (two overlapping squares, top right of the file).
   - In Supabase, click **SQL Editor** (left sidebar) → **+ New query** → paste → **Run**.
   - You should see *"Success. No rows returned."* Under **Table Editor** you'll now
     see tables like `events`, `shifts` and `volunteers`, each marked as protected by RLS.
   - If you get an error instead, copy the red message and send it to me.

## 3. Vercel: puts the website on the internet
1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub** → choose the
   **Hobby** (free) plan.
2. **Add New → Project** → find **3ds** → **Import**.
   If you don't see it, click **Adjust GitHub App Permissions** and allow the repo.
3. Leave everything as is and click **Deploy**. After a minute you'll get a
   link like `3ds-xyz.vercel.app` with the landing page.

> Note: Vercel's free Hobby plan is for non-commercial use. Switch to **Pro
> ($20/mo)** when you start charging customers, not before.

## 4. Connect Supabase to Vercel
In Vercel: your project → **Settings → Environment Variables**. Add these three,
copying values from the Supabase tab from step 2:

| Name | Where to find it in Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | API Keys → **Publishable key** |
| `SUPABASE_SECRET_KEY` | API Keys → **Secret key** (click to reveal) ⚠️ secret |

Then **Deployments → ⋯ → Redeploy**.

Finally, in Supabase → **Authentication → URL Configuration**, set **Site URL**
to your Vercel link and add `https://YOUR-LINK.vercel.app/auth/callback` under
**Redirect URLs**.

## Applying database updates
When a change adds a new file to `supabase/migrations/`, run **only that new file** in
Supabase's **SQL Editor**, exactly like step 2.5. Files run in name order, oldest
first, and each runs once. Running an old one again will error (harmless, but confusing).

| File | What it does | Status |
|---|---|---|
| `20261004000000_core_schema.sql` | All tables and privacy rules | ✅ run |
| `20261004010000_drafts_without_plan.sql` | Draft events are free; publishing needs a plan | ✅ run |
| `20261004020000_event_fixes_and_venue_location.sql` | Fixes "no permission" when creating an event; stores map location | ✅ run |
| `20261004030000_team_invitations_and_editing.sql` | Team invitations, station leads, moving shifts when the date changes | ✅ run |
| `20261004040000_volunteer_signup.sql` | Unique public links for events | ✅ run |
| `20261004050000_volunteer_passes_and_calendar.sql` | No-login volunteer access, calendar invites | ✅ run |
| `20261004060000_bands.sql` | Band registration window, performance order, public schedule | ✅ run |
| `20261005000000_warm_up_duration.sql` | Warm-up length per band (15-minute steps) | ✅ run |
| `20261005010000_ready_position.sql` | Ready position minutes, set per event | ✅ run |
| `20261005020000_breaks_and_finals.sql` | Schedule breaks and a finals round | ✅ run |
| `20261006000000_director_contest_info.sql` | Registration deadline, info and host contact for band directors | ✅ run |
| `20261007000000_director_contact_phone.sql` | Host phone unlocks for directors only the day before and on contest day | ✅ run |
| `20261008000000_finals_ready_position.sql` | Separate ready position for finals | ✅ run |
| `20261009000000_finalists_revealed.sql` | Finals in three stages: schedule, saved finalists, revealed | ✅ run |
| `20261010000000_schedule_updated_at.sql` | "The schedule has been updated" banner | ✅ run |
| `20261011000000_station_leads.sql` | More than one Section Lead per station | ✅ run |
| `20261012000000_co_hosts.sql` | Co-hosts: invite someone to run events with you | ✅ run |
| `20261013000000_lead_permissions.sql` | Leads see band names and status, not contact details | ✅ run |
| `20261014000000_contest_day.sql` | Contest day: ordered check-in stations, parking spots, one-tap stops, notes, undo | ✅ run |
| `20261015000000_push_schedule_back.sql` | Contest day: "Push the schedule back" button | ✅ run |
| `20261016000000_live_status.sql` | Contest day: live status for directors and the public schedule | ✅ run |
| `20261017000000_tap_toggles.sql` | Contest day: tap a done step again to undo it | ✅ run |
| `20261018000000_pilot_requests.sql` | "Join the pilot" requests from the home page | ✅ run |
| `20261019000000_team_emails.sql` | Team: emailed invitations with one-tap accept, and a list of removed members | ✅ run |
| `20261020000000_lead_volunteer_check_in.sql` | Section Leads check in their own station's volunteers on event day | run this next |

## Pilot requests

People who fill in "Join the pilot" on the home page are saved in the database, and each request
is emailed to the support address in `src/lib/brand.ts` (you can reply straight to the person).
This works as soon as `20261018000000_pilot_requests.sql` has been run.

Seeing the list of requests inside the app is a later step: see *Make yourself a FieldCommand
admin* under **Later** below.

## Test data (fake bands and volunteers)
To try features without making real accounts, fill a test event with fake data:

1. On GitHub, open `supabase/test-data/add-test-data.sql` → **Copy raw file**.
2. Supabase → **SQL Editor → + New query** → paste.
3. Near the top, replace `my-test-event` with your event's link name (the part
   after `/e/` in its public link) → **Run**.

You get 12 bands and 40 volunteers signed up for shifts (one shift full). If the
event has no shifts yet, three sample stations with three shifts each are added.
All fake emails are Resend test addresses (`...@resend.dev`): emails to them show
as *Delivered* in Resend, but nobody receives them. The bands are listed under your
own account, so you can also see the director's view.

To clear it, do the same with `supabase/test-data/remove-test-data.sql`. It only
removes the fake records; anything real is left alone.

## Email (Resend) ✅
Sign-in emails are sent by **Resend** from `no-reply@fieldcommandevents.com`.

- Domain `fieldcommandevents.com` (bought in Vercel) is verified in Resend, with
  DNS records added in Vercel, including `_dmarc` TXT `v=DMARC1; p=none;`.
- Supabase → Authentication → **SMTP Settings**: custom SMTP on, host
  `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key with
  *Sending access* to the domain.
- Supabase → Authentication → **Rate Limits**: emails per hour raised to 100.

**Sign-in links that work on any device.** Supabase → Authentication → **Emails** →
for both **Magic Link** and **Confirm signup**, the body is:

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14213d">
  <p style="font-size:18px;font-weight:bold;margin:0 0 16px">FieldCommand</p>
  <p style="font-size:16px;line-height:24px;margin:0 0 24px">Tap the button below to sign in. The link works once and expires in 1 hour.</p>
  <p style="margin:0 0 24px">
    <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email"
       style="background:#1d3a6e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;display:inline-block">Sign in</a>
  </p>
  <p style="font-size:13px;line-height:20px;color:#5b6478;margin:0">If you didn't ask for this, you can ignore this email.</p>
</div>
```

Subject: `Your FieldCommand sign-in link`.

**App emails (volunteer confirmations).** Resend → API Keys → a second key named
`FieldCommand app` with *Sending access* to the domain. Vercel → Environment
Variables → `RESEND_API_KEY` (Sensitive) → Redeploy.

**Web addresses.** Supabase → Authentication → **URL Configuration**:
- Site URL: `https://fieldcommandevents.com`
- Redirect URLs: `https://fieldcommandevents.com/**`, `https://www.fieldcommandevents.com/**`,
  `https://fieldcommand-xi.vercel.app/**`, `https://fieldcommand-*.vercel.app/**`

## Google Maps venue search
Lets hosts type "Panther Stadium" and pick the right place. Without this key the
form simply shows plain venue name and address boxes.

1. Go to **console.cloud.google.com** and sign in with a Google account (ideally the
   business one).
2. At the top, click the project picker → **New project** → name it `FieldCommand` →
   **Create**, then make sure it's selected.
3. **Billing:** Google requires a card on file, even though our usage fits
   comfortably in the free monthly allowance. Left menu → **Billing** → link or
   create a billing account.
4. **Turn on the API:** search the top bar for **Places API (New)** → **Enable**.
   (Pick the one that says *New*.)
5. **Create the key:** left menu → **APIs & Services → Credentials → + Create
   credentials → API key**. Copy it.
6. **Lock the key down:** click the new key → under **API restrictions** choose
   **Restrict key** → tick **Places API (New)** only → **Save**. Leave
   *Application restrictions* as **None**; our server makes the calls, not browsers.
7. **Safety net:** **Billing → Budgets & alerts → Create budget** of **$5** with
   email alerts, so you're told long before any real cost.
8. In **Vercel → Settings → Environment Variables**, add `GOOGLE_MAPS_API_KEY` with
   the key (turn on **Sensitive**), then **Deployments → ⋯ → Redeploy**.

---

## Later: set up when we reach that phase

### Make yourself a FieldCommand admin (whenever you're ready)
Until you do this, pilot requests still arrive by email; you just won't see the list in the app.
In the Supabase **SQL Editor**, paste this, put the email you sign in with between the quotes,
and click **Run**:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'the-email-you-sign-in-with@example.com';
```

It should say "1 row". Your dashboard then shows a **Pilot requests** box at the top, which opens
every request with a status you can set (new, contacted, accepted, declined). Only admins can see
the requests: hosts, volunteers and directors can't.


### 6. Sentry: tells us when something breaks (Phase 5)
sentry.io → sign up with GitHub → create a **Next.js** project. Free tier.

### 7. PostHog: shows how people use the product (Phase 5)
posthog.com → sign up → **US Cloud**. Free tier. We'll turn off session recording
on volunteer pages to respect privacy.

### 8. Stripe: takes payments (Phase 5)
stripe.com → sign up. Building in **Test mode** costs nothing. Activating real
payments asks for business details (EIN or SSN, bank account), so set up your
business entity (an LLC is common) before this step. Talk to an accountant.

### 9. Domain name
Once you've picked a name: buy it at Cloudflare, Namecheap or directly in Vercel
(~$10–15/yr). Check that the name isn't already trademarked (search
**tmsearch.uspto.gov**) first.
