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
| `20261004010000_drafts_without_plan.sql` | Draft events are free; publishing needs a plan | run this with Phase 1 |

## Sign-in emails (Phase 1)
Supabase sends the sign-in emails for now. Two limits until we add Resend:
- It only sends to **your own email** (members of your Supabase organization).
- About **2 emails per hour**.

Until then, **open the sign-in link on the same device and browser where you
requested it.** A link requested on a laptop and tapped on a phone will fail.

**Make sign-in links work on any device (do this once Resend is set up).** Supabase
only lets you edit email templates once custom email (SMTP) is connected, which
Resend gives us for free. Then: Supabase → **Authentication → Emails**. For **both**
the **Magic Link** and **Confirm signup** templates, replace the message body with:

```html
<h2>Sign in to FieldCommand</h2>
<p>Tap the button below to sign in. The link works once and expires in 1 hour.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

Set the **Subject** to `Your FieldCommand sign-in link` and click **Save** on each.

**Allow preview links to sign in.** Supabase → **Authentication → URL Configuration
→ Redirect URLs → Add URL**: `https://fieldcommand-*.vercel.app/**`

---

## Later: set up when we reach that phase

### 5. Resend: sends emails (Phase 2)
resend.com → sign up. You'll need a domain for good email delivery, so buy the
domain once you've picked a name (step 9).

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
