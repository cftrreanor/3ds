# Design review: My team (built pages)

| | |
|---|---|
| **What was reviewed** | The built My team page (`/dashboard/team`): 14 screens covering the Account Host's, co-host's, Volunteer Lead's, and Coordinator's views; every window (remove, invite, cancel, invite again, leave); just you; team full; and a plan without event teams |
| **Stage** | Screenshots before the PR |
| **Size** | Full panel: Product Manager, Product Owner, UX Designer, UI Designer, Software Engineer, UX Content Manager, Marketing Manager, and the usability consultant |
| **Date** | 2026-11-05 |
| **Screenshots** | `docs/design-reviews/2026-11-05-my-team-built/` (84 shots: phone, tablet, and desktop, light and dark; made-up sample data) |
| **Not reviewed** | The event's own team-setup page; undo after removing someone; handing the Account Host role on (both coming in part 3) |

## The consultant's verdict

Ship after fixes. The page is calm and well ordered. The remove windows are among the best confirmation design the consultant has seen in a product this size: they name each role, say what's left without anyone, and the red button says exactly what it removes. Most problems are small and cheap. The one change that would help most: make every invitation row show its real state first (an expired link should look expired, and offer "Send a new link" instead of "Copy link").

## A note on the sample data

The "team full" screen says "8 of 8 team spots" while showing 6 rows. Three reviewers flagged this. It's a slip in the made-up sample data (the count was set by hand), not the page: on the real page the number comes from the database's own count. The real underlying point still stands, and is finding 15: the page never says what counts as a spot. The sample plan names ("Starter", 8 spots) also don't match the real plans, so these screenshots shouldn't be reused in anything customers see.

## Blocks people (severity 3)

Nothing here ships until the owner decides.

### 1. An expired invitation looks live, and "Copy link" hands out a dead link · severity 3 · found by 7 of 8
- **Where:** every invitation row; clearest on screen 12 (ken.wu: "Invited" badge, "Link expired Mon, Nov 2" at the end of the grey line). `view.tsx` `InviteRow`.
- **What happens:** the badge still says "Invited" in the same amber as a working invitation. "Expired" is the last words of a small grey line. "Copy link" copies the dead link and says "Link copied." The person who taps it on event morning gets "This invitation has expired."
- **Who it hurts:** the PTO president and the Volunteer Lead glancing on a phone, who think the helper is on the way; the invited parent, who hits a dead end.
- **Standard:** visibility of system status; error prevention.
- **Suggested fix:** when expired, the badge reads "Link expired"; "Copy link" is hidden; "Resend" becomes "Send a new link" and leads the row; "Link expired Nov 2" moves to the front of the line.
- **Decision:** _Take the advice / Fix it differently / Keep as is (reason)_

### 2. Resending an expired invitation gets around the team limit · severity 3 · found by 1 of 8 (Software Engineer, confirmed in the code)
- **Where:** "Resend" on any expired invitation. Database: `prepare_invitation_email` in `20270113000000_my_team.sql`.
- **What happens:** an expired invitation stops holding a team spot. Resend gives it 30 more days without checking the plan's limit, so a full team (8 of 8) can become 9 of 8. It can also revive a Volunteer Lead invitation on a plan that no longer includes them.
- **Who it hurts:** the business (the limit is what plans sell), and organizers who then see a count over the maximum they can't explain.
- **Suggested fix:** when the invitation has expired, Resend runs the same "is there a spot" check as a new invitation and says "Your team is full" if not. Add a security test. On the page, don't offer Resend on an expired row while the team is full; say why.
- **Decision:** _Take the advice / Fix it differently / Keep as is (reason)_

### 3. Nobody is told when a helper leaves, so a job can quietly lose its leader · severity 3 · found by 5 of 8
- **Where:** screen 14 (Leave an event); "Removed recently" (collapsed); Event teams.
- **What happens:** a Coordinator taps "Leave this event" three days before the event. Gate now has no Coordinator. The Account Host, co-hosts, and Volunteer Lead find out only if they open My team and expand "Removed recently", and that row doesn't even name the job. The leave window doesn't say which job they're dropping or whether anyone is told. Removed people aren't told either, so they may still turn up.
- **Who it hurts:** the PTO president (whose main fear is something slipping through the cracks) and the organizer, who finds an empty job on the day.
- **Standard:** visibility of system status.
- **Suggested fix (pick how far to go):**
  - Smallest: the leave window names the job ("Parking will need a new Coordinator") and says "We don't tell Dana Whitfield, so let them know"; Event teams shows "Gate at Lone Star needs a Coordinator", linked to the event.
  - Fuller: when someone leaves, email the Account Host and the event's Volunteer Lead, and say so in the window. Offer an optional "Let Tasha know by email" when removing.
- **Decision:** _Take the advice / Fix it differently / Keep as is (reason)_

### 4. "Every role" also deletes the person's past-event history · severity 3 · found by 3 of 8 (a bug, confirmed in the code)
- **Where:** screen 03, the Remove window's "Every role below (2)". `team-actions.ts` `removeFromEvents`.
- **What happens:** the window lists 2 upcoming roles, but the server removes the person from every event on the account, including events that are over. They vanish from "Past events" (so "Invite again" next year is gone), and the success message can say "Removed from 4 events" after the button said 2.
- **Who it hurts:** the PTO president, who loses the "reuse last year's helpers" list.
- **Suggested fix:** "Every role" sends exactly the roles listed in the window. The server refuses roles on events that are over.
- **Decision:** _This is a bug; recommend fixing it as part of this PR_

### 5. Someone on two accounts only ever sees the older one · severity 3 · found by 1 of 8 (Software Engineer, confirmed)
- **Where:** every host view. `load.ts` uses `getMyOrganization()`, which picks the oldest account the person belongs to.
- **What happens:** a PTO president who owns their own account and is also a co-host on an older band boosters account lands on the boosters' team, as a co-host. They can't manage their own account's team from My team. This limit is app-wide today ("multi-org comes later" in the code), but co-host invitations to whole accounts will make it more common.
- **Who it hurts:** organizers who help more than one school or group.
- **Suggested fix:** show one section per account (the one they own first), or an account switcher at the top. Or knowingly keep the app-wide limit for now and log it.
- **Decision:** _Take the advice / Fix it differently / Keep as is (reason)_

### 6. "Can't see those events anymore" isn't true · severity 3 · found by 1 of 8 (Software Engineer, confirmed)
- **Where:** "Past events" ("They don't hold a team spot, and can't see those events anymore"). Database: `is_event_staff` and `can_manage_volunteers` don't check whether the event is over.
- **What happens:** a Volunteer Lead of a finished event can still read that event's volunteers and their contact details. The page tells organizers otherwise.
- **Who it hurts:** volunteer families, whose details stay visible; organizers, who are told they're protected.
- **Suggested fix (a product decision):**
  - (a) Fix the words now: "They don't hold a team spot", and give past rows a "Remove" so organizers can end access.
  - (b) End access in the database a set number of days after the event, with security tests. Bigger change, touches every page past helpers use.
- **Decision:** _Take the advice (a or b) / Fix it differently / Keep as is (reason)_

### 7. An edited co-host email can go out with band-contest wording and an empty "()" · severity 3 · found by 2 of 8
- **Where:** the co-host invitation email (`invitation-email.ts`, `system-emails.ts`), sent from "Invite a co-host".
- **What happens:** the built-in email is fine. But if an admin has saved their own wording for the co-host email, an invitation to the whole account (no event) fills in as "…starting with Cedar Ridge PTO's events ()" and describes "bands, the schedule, … and contest day" even for a PTO.
- **Who it hurts:** every invited co-host's first impression, once any custom wording is saved.
- **Suggested fix:** with no event, use general access words and drop the "starting with…" part; the email editor previews the no-event case.
- **Decision:** _Take the advice / Fix it differently / Keep as is (reason)_

### 8. "Ask us about a bigger team" is a bare email link that doesn't name the fix · severity 3 · found by 2 of 8
- **Where:** screens 10 and 11 (team full; plan without event teams).
- **What happens:** the link opens a blank email (on a school computer with no mail app, nothing happens). The page never names the plan that adds spots or Volunteer Leads, though the Account page does. On screen 11 the same upgrade is asked for twice.
- **Who it hurts:** the PTO president on a phone, the front office on a shared computer.
- **Suggested fix:** name the next plan and link to the plan card on the Account page; show the email address as text next to any email link; ask once per screen.
- **Decision:** _Take the advice / Fix it differently / Keep as is (reason)_

## Should fix (severity 2)

1. **The windows don't match each other** (7 of 8). Two layouts; the way out is "Keep Marcus", "Never mind", or "Not now"; "Leave this event" and "Stop being a co-host" get a calm blue button while cancelling an invitation (easy to redo) is red; only the co-host window says "a team spot opens up". Fix: one window layout; "Keep {name}" for removals and leaving, "Not now" for invitations; red for anything that takes access away; "A team spot opens up" whenever it does.
2. **The Coordinator's page leads with "Leave"** (7 of 8). It doesn't show the job they lead or their Volunteer Lead (the person they'd actually call). Fix: "leads Parking · Volunteer Lead: Marcus Lee" on each row; Volunteer Lead first under "Questions?"; Leave as a quieter button.
3. **"Invite again" brings a Coordinator back with no job** (6 of 8). It picks the first event for you, can't change the role, doesn't mention the team spot, and the title shows the email instead of the name. Fix: role and optional job choices; start with "Choose an event"; dates in the list; the team-spot line; "Invite Rosa Diaz again".
4. **"Send invitation" looks switched off** (4 of 8). The app's "not ready" dashed style makes "Not now" look like the main button, and dashed also means "can't" and "nothing here" elsewhere. Fix: keep it a filled button in short windows; a separate look for truly blocked buttons.
5. **Buttons vanish without a reason** (4 of 8). When full, "Invite again" disappears; a co-host sees no button on a removed co-host; the Volunteer Lead's view ignores the limit entirely. Fix: a short note where the button was ("Free a spot to invite again", "Only the Account Host invites co-hosts").
6. **Button outlines are nearly invisible** (2 of 8, measured). 1.25:1 in light, 1.43:1 in dark; house rule is 3:1. Fix: the stronger field-border color for secondary buttons.
7. **Windows blend into the page in dark mode** (2 of 8, measured). Fix: darker backdrop and a raised window color with a visible edge.
8. **Screen readers hear "Remove…, Remove…, Copy link, Copy link"** (3 of 8). Several row buttons don't name their person, and "Cancel invitation"'s spoken name doesn't contain its visible words. Fix: names that start with the visible words, then the person.
9. **Focus is lost after removing someone** (1 of 8). The row disappears and keyboard focus jumps to the top. Fix: move it to the next row or the section heading.
10. **The spot count doesn't say what counts** (4 of 8). "Invitations count until they're accepted" reads as if accepting frees the spot; the Account Host taking a spot isn't mentioned; the count has no verb. Fix: "6 of 8 team spots used, counting you and 2 open invitations"; "Invitations take a spot as soon as they're sent".
11. **Removing someone's last role doesn't say a spot opens** (3 of 8). That's the reason to remove someone on a full team.
12. **A plan without event teams explains them, shows an empty box, then says you can't have them** (4 of 8). Fix: one line that says what they are and what plan includes them.
13. **Coordinators are added from two places with two names** (2 of 8): "an event's team setup" for hosts, "Volunteer setup" for leads. Pick one name.
14. **"Hosts" means two things** (1 of 8). The heading includes co-hosts, the privacy note treats them as separate. Fix: "Only the Account Host and co-hosts see…".
15. **The privacy note isn't quite true** (1 of 8). Volunteer Leads also see their event team's emails and phones, and the Account Host's email is shown to every Coordinator through a lookup that bypasses the database's privacy rules. Fix: say what's true, and move the Account Host lookup into a database function with tests (the project rule).
16. **Messages point to a "Pending" list My team doesn't have** (3 of 8); "Only the Account Host can remove a co-host" also shows when a co-host was simply already removed. Fix the wording.
17. **No "a database update is needed" page or load errors** (2 of 8). If the update hasn't been run, the page shows a made-up count and an empty team. Fix: call `missing()` (project rule) and show a real error otherwise.
18. **A host who is also a Volunteer Lead elsewhere never sees that lead view** (1 of 8).
19. **The full-team block is stricter than the database** (1 of 8): you can't promote an existing helper to co-host on a full team, though the database would allow it.
20. **The co-host sentence is vague where it matters** (3 of 8). It tells the Account Host about themselves in the third person, and tells the invitee about "the Account Host" without saying who. Fix: "A co-host can do everything you can on every event, except invite or remove co-hosts"; in the email, name the Account Host and the work.
21. **The most visible button gives the widest access** (1 of 8). Someone who wants "Jen to run parking" sees one button: Invite a co-host. Fix: an equal "Add someone to an event" choice.
22. **Event-link lists wrap mid-name on phones** (1 of 8); long emails in window titles can overflow at 320 px (1 of 8); invitation detail lines are a run-on and split dates across lines (2 of 8).
23. **Queries load every event the account has ever had** (1 of 8). Slow for older accounts; fix with joins and limiting past events.
24. **Missing security tests** (1 of 8) for a few of part 1's rules, and one misleading test comment.
25. **States not yet designed** (1 of 8): success, errors inside windows, loading, a Volunteer Lead with no Coordinators, no upcoming events, an unlimited plan, an expired co-host invitation.

## Polish (severity 1)

- "Removed recently" also lists people who left: call it "Removed or left recently" (3 of 8)
- "We don't email them" belongs in the remove windows, with "so let them know yourself" (2 of 8)
- "Canceled" and "cancelled" are both used; pick US "canceled" (2 of 8)
- "Past events" heading over a list of people; "Helpers" is a new word (1 of 8)
- "Your team is full" appears three times on one screen (1 of 8)
- "Removed recently" doesn't look like it opens; add a chevron (1 of 8)
- Role badges and event links are applied unevenly between sections (1 of 8)
- Invitation buttons wrap 2 + 1 on phones (1 of 8)
- Subject line "You're invited to co-host Cedar Ridge PTO…": name the inviter (1 of 8)
- Dark-mode radio buttons use the browser's grey (1 of 8)

## What's working well

- **The remove window for someone with several roles** (praised by all 8): pick one role or all, it names exactly which job is left without anyone, says what they keep, and the red button names the result ("Remove from 2 events"). "Keep Marcus" as the way out.
- **Each role sees only what it can act on.** A co-host gets "Stop being a co-host" and no buttons they can't use; a Volunteer Lead sees only their Coordinators.
- **The limit is explained when you hit it**, in words, with what to do; the blocked button says why instead of disappearing.
- **"It's just you so far"** explains co-hosts versus one-event helpers in a parent's own words.
- **Brand voice is clean**: no exclamation points, Oxford commas, role names used correctly.
- **Phone layouts hold up**: 44 px buttons, no sideways scrolling, dark mode complete.
- **The database enforces the removal rules**, and the actions treat "nothing changed" as nothing changed, with clear "already removed" messages.

## By role

- **Product Manager:** the gap is "nothing falls through the cracks": leaving, removing, and expiring links all happen silently (rated 3). Also: the biggest button gives the widest access; suggests measures (invitations accepted within 7 days, jobs without a leader 3 days out).
- **Product Owner:** same silent-leaving finding at 3; wrote 16 acceptance criteria (below); flagged undesigned states and the missing database-update page.
- **UX Designer:** nothing blocking; the windows and dashed buttons are inconsistent, and the Coordinator's page offers only the exit.
- **UI Designer:** expired invitations at 3; measured faint button edges and dark-mode windows; dates and links that wrap badly.
- **Software Engineer:** the four confirmed code problems (Resend gets around the limit, "every role" deletes history, two accounts, past helpers keep access), plus privacy-note accuracy, load errors, and query size.
- **UX Content Manager:** nothing blocking; 19 wording fixes with exact replacements ("hosts" two ways, "Pending", "job" versus "sign-up").
- **Marketing Manager:** the edited-email breakage and the "ask us" dead end, both at 3; the co-host invitation sells rules instead of the work.
- **Consultant:** ship after fixes; expired invitations at 3 (rated higher than a product team might, because the handiest button causes a failure nobody sees until later); focus and screen-reader names.

## Acceptance criteria (from the Product Owner)

1. Given I'm the Account Host, when I open My team, then I see the hosts, co-host invitations, and every Volunteer Lead and Coordinator on events that aren't over, each person once with all their roles, and "used of max" team spots.
2. Given the count shows N of M, when I count the people and live invitations listed, then they add up to N.
3. Given I'm a co-host, when I open My team, then I see no invite, Resend, or Cancel on co-host invitations, and "Stop being a co-host" on my row.
4. Given the team is full, when I view the page, then every invite action is blocked with its reason shown.
5. Given I remove a person from every role, when I confirm, then they leave only the listed upcoming events, keep their Past events history, appear in Removed recently, and the success message names the same number of events as the button.
6. Given I remove one of two roles, then the window told me they keep their team spot.
7. Given removing someone leaves a job with no Coordinator, then the window names it, and afterward Event teams shows "<Job> at <Event> needs a Coordinator".
8. Given a Coordinator leaves, then the Account Host and Volunteer Lead are told (or the window says they aren't).
9. Given an invitation's link has expired, then its badge reads "Link expired", it doesn't count as a spot, and "Send a new link" checks the limit.
10. Given I choose Invite again for a past Coordinator, then I can pick the event (with its date), the role, and the job, and see the team-spot note.
11. Given the database update hasn't been run, then I see "a database update is needed", not an empty team.
12. Given a team query fails, then I see an error with a way to try again, not empty lists.
13. Given I'm a Coordinator, then each role row shows my job and my Volunteer Lead.
14. Given I'm a Volunteer Lead on a full account, then Invite again isn't offered and the page says who to ask.
15. Given I use a screen reader, then each row button names its person.
16. Given any message tells me where to look, then it names something on this page.

## Limits

This is an AI review of screenshots and code, not testing with real people, and no accessibility scanner was run against a live page. For the severity 3 findings, especially silent leaving and expired invitations, have two or three real Account Hosts (one a PTO president on a phone) invite, remove, and re-invite a helper before launch.
