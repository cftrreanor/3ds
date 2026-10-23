# QA site setup (no coding needed)

The QA site is a private copy of the whole platform for reviewing pages and copy.
It has its own database with test data, so nothing anyone does there reaches real
families or events. Every email it would send goes to its **Outbox** instead.

You set it up once. After that it updates itself: each change that reaches the live
site also reaches QA, and so does each database update.

> 🔒 **Golden rule:** never paste a password, key, or connection string into a chat,
> email, or GitHub comment. You'll put each one straight into the settings screen
> that needs it.

Plan on about 30 minutes. Do the steps in order.

---

## 1. A second Supabase project (the QA database)
1. Go to **supabase.com** and open your dashboard.
2. **New project**:
   - Name: `fieldcommand-qa`
   - Database password: click **Generate**, then **save it in your password manager**
     as "Supabase QA database password"
   - Region: the same one as your live project
   - Plan: **Free**
3. Wait about 2 minutes for it to finish.

You don't need to run any database updates by hand here. Step 4 does that for you.

## 2. A second Vercel project (the QA website)
1. In **vercel.com**, click **Add New → Project**, find **3ds**, and click **Import**.
2. Name it `fieldcommand-qa`. Leave everything else as it is.
3. Before clicking **Deploy**, open **Environment Variables** and add the ones in
   the table below. Turn on **Sensitive** for each one marked ⚠️.
4. Click **Deploy**.

| Name | Value |
|---|---|
| `QA_MODE` | `1` |
| `QA_REVIEWERS` | Each reviewer's name and passcode, like `Becca:sunflower-river-42,Cleave:maple-cloud-77` ⚠️ |
| `NEXT_PUBLIC_SUPABASE_URL` | QA Supabase project → **Project Settings → Data API → Project URL** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | QA Supabase project → **API Keys → Publishable key** |
| `SUPABASE_SECRET_KEY` | QA Supabase project → **API Keys → Secret key** ⚠️ |
| `CRON_SECRET` | A new long random password, different from the live one ⚠️ |

How to fill in `QA_REVIEWERS` (one line, no spaces needed):

```
Name:passcode,Name:passcode
```

- **Colon** `:` between a person's name and their passcode.
- **Comma** `,` between one person and the next.
- So for two people it looks like `Becca:sunflower-river-42,Cleave:maple-cloud-77`,
  with your own made-up passcodes in place of those examples.
- For one person, just `Becca:sunflower-river-42` (no comma).
- Make up a passcode for each person, at least 6 characters. Three random words
  and a number are easy to type and hard to guess.
- The name is what the QA bar shows ("Reviewing as Becca").
- Send Becca her passcode yourself, by text or in person.
- To let someone new in, add them to `QA_REVIEWERS`. To lock someone out, take
  them off. Then **Deployments → ⋯ → Redeploy**.

Leave out the email key (`RESEND_API_KEY`). The QA site never sends email, so it
doesn't need one.

## 3. A web address for it
1. In the `fieldcommand-qa` Vercel project: **Settings → Domains → Add**.
2. Type `qa.fieldcommandevents.com` and follow Vercel's instructions. It shows one
   record to add where you bought the domain, and checks it for you.

Then, in the **QA** Supabase project: **Authentication → URL Configuration**:
- **Site URL:** `https://qa.fieldcommandevents.com`
- **Redirect URLs:** add `https://qa.fieldcommandevents.com/auth/callback`

## 4. Let GitHub keep the QA database up to date
1. In the **QA** Supabase project, click **Connect** (top of the page).
2. Under **Session pooler**, copy the connection string. It starts with
   `postgresql://postgres.` and includes `pooler.supabase.com`.
   Use **Session pooler**, not "Direct connection": GitHub can only reach that one.
3. Replace `[YOUR-PASSWORD]` in it with the QA database password from step 1.
4. On GitHub, open the **3ds** repository → **Settings → Secrets and variables →
   Actions → New repository secret**:
   - Name: `QA_DATABASE_URL`
   - Secret: the connection string from step 3
5. Load the database the first time: **Actions** tab → **QA database** (left side) →
   **Run workflow** → **Run workflow**. After a minute or two, it shows a green check.

From now on it runs by itself whenever a database update reaches the live site.

## 5. Try it
1. Open `https://qa.fieldcommandevents.com` and enter your passcode.
2. You land on your dashboard, signed in as your own QA account, with a blue bar
   across the top: **QA site**, who's reviewing, **Outbox**, and **Switch reviewer**.
3. Create an organization and an event, the way an organizer would.
4. Sign up for something on it (a volunteer shift or a conference time), then open
   **Outbox** to see the email.

Each reviewer's QA account is an admin, so **Admin** and demo mode's **View as**
work there too. Tell me "The QA site is set up" when it's done.

---

## Using the QA tools
Every QA page has a **QA tools** button in the bottom-right corner. It opens:

- **See this page on a phone:** the page you're on, at phone size.
- **Your test events:** each event in your test organization, with links to its
  organizer view and its public pages, and **View as** (Host, Volunteer Lead,
  Section Lead, Director, Volunteer, or Parent) to see it as that person.
- **Ready-made events:** one click makes a published event, dated from today and
  filled with sample people: a band contest with registration open, a band contest
  happening today, a choir festival, a school fair, a volunteer event, a family
  visitor day, or parent-teacher conferences with families already booked.
- **Pages:** every website page and organizer screen, plus the Outbox.
- **Start over:** deletes every event in your own test organization. Other
  reviewers keep theirs.

To see a different day (an event tomorrow, or happening right now), make the
ready-made event that's dated that way, or change an event's date on its
**Edit details** page.
