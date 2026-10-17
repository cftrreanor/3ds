# Penetration test, October 2026

A security review of Field Command Events: the app's code, the database's privacy
rules, and the outside code it depends on. The live site wasn't attacked (this test
environment can't reach it), so the database was attacked on a full local copy
instead, built from every migration and filled with realistic sample people.

## Summary

- **No critical, high, or medium issues in the database.** Every table has privacy
  rules on, every private function checks who's asking, and private links use long
  random keys, not guessable numbers. As a signed-out visitor and as a signed-in
  stranger, the test tried to read and change every table and call every function
  with another account's details. Nothing private came back, and nothing changed.
- **No critical or high issues in the app.** Two medium issues (inboxes could be
  flooded by email) and several low ones were found. The ones that could be fixed
  safely are fixed below, and the rest need a decision.
- **Outside code (npm audit):** no known vulnerabilities in anything the live site
  runs. Five "high" warnings are in the code checker used only while building
  (`eslint-config-next`), which never reaches visitors. They clear when Next.js
  updates it.

## Fixed in this update

| Severity | Issue | Fix |
|---|---|---|
| Medium | Sending the same volunteer sign-up again (by hand or by a script) re-sent every confirmation email, so someone's inbox could be flooded with up to 13 emails per try | The confirmation only goes out when something new was booked |
| Medium | A host (including a free teacher account) could re-send one invitation, or cancel and re-invite, over and over, sending unlimited emails | The same invitation can be re-sent once every 5 minutes, and one account can send at most 40 invitation emails an hour (database update `20261129000000_security_hardening.sql`) |
| Low | Emailed private links were built from the address the request said it came to | On the live site, links always use the site's own address |
| Low | An uploaded file's storage location was only checked by its start | It must exactly match the shape the app made |
| Low | Visitors who aren't signed in still held "write" permission on some tables (the privacy rules blocked every attempt, but that was the only barrier) | The permission is removed, so a future mistake in a rule can't open it up |
| Info | The daily job's password was compared in a way that could, in theory, leak it through timing | Compared in constant time |
| Info | A stray line break in a calendar invite's text wasn't fully escaped | Escaped |

All of these have automated tests (`supabase/tests/security_test.sql`) or were checked
in a browser.

## Needs your decision

1. **Bot protection on public forms** (Medium). ✅ **Built (October 2026):** Cloudflare Turnstile is on the five public
   forms and turns on when its keys are added (docs/SETUP-GUIDE.md, "Bot protection"). Original note: Volunteer sign-up, parent registration,
   conference booking, and the pilot form have simple bot traps that a determined
   script can get past. Someone could fill a teacher's conference times with fake
   bookings, or use the forms to send emails to people who didn't ask. Recommended:
   - add **Cloudflare Turnstile**, a free and privacy-friendly "I'm not a robot"
     check that most people never see; it needs a free Cloudflare account;
   - add **Vercel Firewall rate limits** on these forms, a few clicks in Vercel.
2. **Sign-in link from someone else** (Low). Sign-in links work on any device, by
   design. The flip side is that someone could send a person a link to the
   attacker's own account, and if they don't notice, what they register lands in the
   attacker's account. A fix (the link only works in the browser that asked for it)
   would undo the "works on any device" choice. Recommended: keep as is for now, and
   revisit if accounts start holding payments.
3. **"Already registered" messages** (Low). The parent registration and volunteer
   forms say when an email is already signed up. Someone who knows a parent's email
   could learn they're registered at a school event. A fix means new registrations
   confirm by email first, which adds a step for families.
4. **Address search costs** (Low). Any account, including free teacher accounts, can
   use the paid Google address search without a per-person limit. The $5 Google
   budget alert in the setup guide is the safety net. A per-person daily limit can be
   added if usage grows.

## What was checked and found sound

- **Database:** row level security on every table; about 115 private database
  functions, each pinned to the right schema and checking membership first; private
  links (bookings, registrations, volunteer passes, invitations) looked up only by
  their random key; uploaded files in a private storage bucket served by
  60-second links; no database views that skip the rules.
- **App:**
  - Every action that uses the server's master key checks who's asking first, or
    needs a private link.
  - Admin pages each check for an admin.
  - Sign-in redirects only go to this site.
  - Emails escape everything people type.
  - No secret keys are sent to browsers.
  - Pages can't be shown inside other sites.
- **Error alerts (Sentry):** reports carry no names, emails, form contents, cookies,
  or private link keys. Tested by sending real errors to a stand-in server and
  checking what arrived.
