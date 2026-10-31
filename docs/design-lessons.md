# Design lessons

What the design review panel keeps finding, written as rules so we stop getting dinged for the
same thing twice. Each lesson came from at least two reviews (listed under "Seen in").

**How this file is used** (see `.claude/skills/design-review/SKILL.md`):
- **Before** mocking up or building anything people see: read it.
- **Before** every panel or light check: go through the self-check at the end, and fix what fails.
- **After** every review: a finding seen for the second time becomes a lesson here. A lesson that
  gets dinged again gets a sharper rule, or an automatic check.
- **Never** show this file to the reviewers. They review cold; this file only changes what we do
  before they look.

Lessons marked **Checked automatically** fail `npm run lint` (scripts/design-lint.mjs).

---

## L1. One fact, one source
Every count or status (bands registered, spots filled, ready jobs, plan state) is worked out once
per page and shown from that one result. Don't repeat the same fact in three places; repeat a
**link** to it instead.
- **Why:** the moment two numbers disagree, people trust neither.
- **Seen in:** event setup (four different step counts), My events (three names for what ended),
  volunteer jobs v1 (totals: "2 of 8" vs "2 of 20"), band contest v2 ("0 bands" next to
  "12 registered", 8 of 8 reviewers).
- **Mock-ups too:** sample data follows one timeline. Check every number against every other screen.

## L2. Design every state, not just the happy one
For each screen, show: empty, first time (no history), in progress, saved, **failed**, already
done (invited, registered), full, closed and reopened, ended or past, and the blocked version.
- **Why:** the missing state is where people get stuck, and builders guess it differently.
- **Seen in:** setup redesign (live with sign-up closed missing), volunteer jobs (failed save,
  name-only), band contest v1 (no first-time host, no close/reopen, no already-invited).

## L3. Saving never loses work
Automatic saving shows **Saving…, Saved, Couldn't save (Retry)**, and **typed but not added**.
Leaving waits for pending saves; if one failed, stay and say which field. Mark the failed field
itself, not only the bar. Save one field at a time, so two co-hosts don't undo each other.
- **Why:** "Saved" while something wasn't is the worst kind of surprise.
- **Seen in:** setup redesign v2 and v3 (three kinds of saving), volunteer jobs v3 and v4 (lost
  edits, offline, typed shifts), band contest v1 and v2 (Next up leaves with a failed save).
- **Build with:** `src/components/pending-edits.ts` (`setPending`, `useLeaveGuard`).

## L4. The screen's rules are the database's rules
Anything the page says can't happen ("publishing needs a deadline", "can't delete a job with
sign-ups", "can't remove a classification with bands") is refused by the database, with a case in
`supabase/tests/security_test.sql`. Hiding a button is not enforcement.
- **Why:** a second tab, a co-host, or an old link goes around the page.
- **Seen in:** event setup (drafts went live), setup redesign v3 (hidden jobs), volunteer jobs v1,
  band contest v1 and v2 (publish rule, classifications, reopen).

## L5. One word per thing, one thing per word
Pick one name and use it everywhere: in buttons, headings, emails, and the website. Never reuse
a word for two things on one screen.
- **Why:** people act on words, not on our intentions.
- **Seen in:** "Ready" (job vs event), "Hidden/Draft", "Check-in" (stage, stop, and arriving),
  "Parking" (stop and job), "Import" (three names), "post" vs "publish" the schedule, role names
  ("Volunteer Lead", "Coordinator"), "sign-up" vs "job" on volunteer events.
- **Before naming:** check `docs/brand-voice.md` and grep the app for the word.

## L6. Dark mode: muted text is white
In dark mode `--muted` is pure white, so anything that relies on grey looks live or filled in.
- Greyed-out controls use `text-disabled` and a dashed border, plus a reason in words.
  **Checked automatically** (muted-disabled).
- Placeholders must look empty; long example text goes in a hint under the label.
- Text on red buttons uses `text-danger-foreground`, never white. **Checked automatically**
  (white-on-danger).
- Checkboxes and radios follow `color-scheme` and the brand accent.
- **Seen in:** setup redesign v1 and v3, volunteer jobs v3 and v4, band contest v1 and v2.
- **Always:** look at the dark screenshot of every screen before a review.

## L7. Don't fade things people can still use
Fading means "you can't". If it still works (an ended shift, a ready card), keep it full strength
and add a word like "Ended". Only disabled controls fade, and they say why.
**Checked automatically** (faded-container).
- **Seen in:** volunteer jobs v3 (faint buttons that worked), check-in desk (ended shifts looked
  disabled), badges (Print faded with no reason).

## L8. Promise only what the app does
Every claim on a screen, in an email, or on the website must be true in the code today: "one
tap", "directions", "in one step", "the order is filled in", "add a plan", "last year's contest".
- **Why:** a broken promise costs more trust than a modest one earns.
- **Seen in:** setup redesign v1 (plan words), My events ("free" claim), band contest v1 and v2.
- **Check:** for each promise, find the code that keeps it.

## L9. Warnings are earned
Amber and warning icons only for things that are due soon or block the current step. Anything
else is a calm "Before contest day" item with a due date and the reason for the date.
- **Why:** warnings that cry wolf get ignored when one matters.
- **Seen in:** volunteer jobs (amber marks with no reason), band contest v1 and v2 (check-in stops
  flagged a month early, unexplained "due Mar 6").

## L10. No doors to empty rooms, no dead ends
Don't offer a link or action before there's something behind it (a volunteer link with no jobs,
"Move people" with no move page, a step link before the step exists). Every blocked state names
the one missing thing and gives one button to fix it.
- **Seen in:** setup redesign v2 (Move or remove leads nowhere), volunteer jobs v3 (dead Next),
  band contest v1 ("open later") and v2 (volunteer link before jobs).
- **Good model:** "Not ready to publish yet. Publishing needs a registration deadline. Everything
  else can wait. [Add a deadline]"

## L11. Show who gets emailed before anything is sent
Before an email goes out, the sender can see and untick every recipient. Mark people already
emailed. Say "Sending…" until it's sent, and show what couldn't be delivered. Sending again never
breaks the link in an earlier email.
- **Seen in:** event setup (try-it events emailing outsiders), My events, band contest v1 (and 14
  more, 8 of 8 reviewers) and v2 (re-sent links, "Sent" too early).

## L12. Phone basics
Buttons and links people tap are 44 px tall with 14 px words. **Checked automatically**
(small-control). Status is said in words, never by color alone (keep "✓ Done" on phones). No
sideways scrolling; long words and links wrap cleanly; tab rows don't wrap into two rows.
- **Seen in:** every review.

## L13. One main action; keep destructive actions apart
One filled button per view. Delete and close sit away from it, in red, with a confirmation that
says what happens to the people involved (and offers the way back, like "You can reopen it").
- **Seen in:** volunteer jobs (Delete job next to Add another job), check-in desk, band contest
  v1 and v2 (Close registration).

## L14. Line icons, not emoji
Use `LineIcon` and `IconTile` (src/components/line-icon.tsx). **Checked automatically** (emoji).

## L15. The same kind of page looks the same
Setup steps share one layout: back link, step bar, title, then the card. Footers share one
pattern: status on the left, one button on the right. Status lines, badges, and notes use one
style each.
- **Seen in:** setup redesign, volunteer jobs v3, band contest v1 (three layouts for three steps).

## L16. Say who can see personal details
Wherever a phone number, email, or child's details are entered or shown, say in one line who
sees them and when. Defaults filled in from someone's profile are suggestions until saved.
- **Seen in:** setup redesign v3 (Coordinators and phone numbers), volunteer jobs v4 (phone note
  promised the wrong people), band contest v1 and v2 (director contact).

---

## Self-check before a review

Go through every screen, in light **and dark**, at phone **and** desktop. Fix anything that fails
before the panel sees it.

- [ ] **L1** Every number agrees with every other number, on this screen and the others
- [ ] **L2** Empty, first-time, failed, already-done, closed, and blocked states exist
- [ ] **L3** Saving shows its states; nothing typed can be lost by leaving
- [ ] **L4** Every "can't" on screen has a database rule and a security test (or is planned)
- [ ] **L5** No word means two things; no thing has two names
- [ ] **L6** Dark mode: greyed-out looks greyed out, empty looks empty, red buttons readable
- [ ] **L7** Nothing faded that still works
- [ ] **L8** Every promise is true in the code
- [ ] **L9** Amber only for what's due or blocking
- [ ] **L10** No link to an empty page; every blocker names its fix
- [ ] **L11** Recipients visible before sending; re-sends keep old links working
- [ ] **L12** 44 px targets, status in words on phones, no sideways scroll
- [ ] **L13** One filled button; destructive actions apart and confirmed
- [ ] **L14** No emoji
- [ ] **L15** Same layout as its sibling pages
- [ ] **L16** Personal details say who sees them
- [ ] `npm run lint` passes (includes the automatic checks)
