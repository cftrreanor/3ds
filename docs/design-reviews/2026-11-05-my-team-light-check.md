# Design review: My team, light check after fixes

| | |
|---|---|
| **What was reviewed** | The built My team page after the owner's decisions on the first review: 16 screens (host, co-host, every window, just you, team full, inviting when full, a plan without event teams, Volunteer Lead, Coordinator, leave, the accounts menu) |
| **Stage** | Screenshots before the PR (light check on the changed parts) |
| **Size** | Light check by every role that raised findings: Product Manager, Product Owner, UX Designer, UI Designer, Software Engineer, UX Content Manager, Marketing Manager, usability consultant |
| **Date** | 2026-11-05 |
| **Screenshots** | `docs/design-reviews/2026-11-05-my-team-light-check/` (96: phone, tablet, desktop, light and dark; made-up sample data) |
| **Not reviewed** | Undo after removing; handing on the Account Host role (part 3) |

## The consultant's verdict

Ship after fixes. Each role sees only what it can act on, every destructive window spells out what happens, and the labels, tap sizes, and focus handling are solid. One flow still needs work: inviting a co-host when the team is full.

## Blocks people (severity 3)

### 1. On a full team, "Invite a co-host" asks for an email when it should let you pick someone · found by 6 of 8 (3 rated it 3)
- **Where:** Invite a co-host window when the team is full (10b).
- **What happens:** the note says only someone already on the team can be made a co-host, but the window still asks the Account Host to type that person's exact email. Typing a new person's email only fails after Send.
- **Who it hurts:** the PTO president on a phone, who doesn't have everyone's email memorized.
- **Standard:** recognition rather than recall; error prevention; WCAG 3.3.7 (the app already knows these emails).
- **Suggested fix:** on a full team, replace the email box with a list of the people who can be made co-host (Volunteer Leads, Coordinators, and open invitations), by name and role, with the button "Make co-host". Optionally, "Make co-host" on each Event teams row too.
- **Already fixed:** the hint under the box no longer contradicts the note ("Someone already on your team doesn't take another spot").
- **Decision:** _Waiting for the owner_

### Fixed during the light check (bugs within decisions already made)
- **The removal email said "you're no longer on the team" when the person kept another role** (3 of 8; Content Manager rated it 3). It now names exactly what was removed, from what the database actually removed, and says what they still are.
- **Invitation rows were crushed on tablets when the accounts menu showed** (2 of 8; UI Designer rated it 3). Rows now lay out by the card's own width.
- **A past Volunteer Lead could still see the account's volunteer history** (Software Engineer, 3). Volunteer tracking now has the same 10-day cut-off as the event, with tests. Leaving an event that's over is refused, since that role is history.

## Should fix (severity 2)

Fixed during the light check:
- On a full team, a Volunteer Lead was offered "Send a new link", and the no-Coordinator note offered "Invite a Coordinator" (5 of 8). Both now say to free a spot.
- Plans with no team limit talked about team spots (3 of 8). They don't now, and the header counts spots, not "people".
- The Volunteer Lead and event-team paths showed an empty page when a load failed (Software Engineer). They now show the error or database-update page.
- Removing a co-host said "stops leading any jobs" without saying which (3 of 8). It now says what the database does.
- Leaving said everyone was emailed even if the email failed (Software Engineer).

Waiting for the owner:
- **Removing someone doesn't tell the event's Volunteer Lead** that a job is now empty (Product Manager). Leaving does.
- **Coordinators can't see their Volunteer Lead** (3 of 8). A privacy choice for the owner.
- **Windows blend into the page in dark mode** (2 of 8, also in the first review), and **unselected radio buttons are faint in dark mode** (2 of 8).
- **The remove window starts on "every role"**, the biggest choice (UX Designer). Suggest starting with nothing picked.
- **A full team shows blocked actions three ways** (UI Designer, consultant): a greyed button, a reason in text, or a working button.
- **"Link expired" looks calmer than "Invited"** (UI Designer).
- **The accounts menu sits above the page title on phones**, and labels event-team accounts "Event team" instead of the role (2 of 8).
- **The co-host email's editor text** still lists "the team" and no exception (Marketing Manager).
- **"Removed recently" also lists people who left** (4 of 8, also in the first review).

## Polish (severity 1)

Window buttons wrap unevenly on phones; the Feedback tab covers line ends on tablets; "led" and "leads" for the same past job; "canceled" and "cancelled" both used; some bullets end with periods; the one-event hint in Invite a co-host has no link.

## What's working well

- The remove window for someone with several roles (all 8 again): each role, what's left without anyone, whether a spot opens, and a button that names the result.
- Blocked actions explain themselves in place.
- "Invite again" fills in last time's role and the job that's now empty.
- The no-Coordinator note ("Snack bar at Fall Festival has no Coordinator. Lee Ann Park left Wed, Oct 28") catches gaps.
- Each role sees only what it can act on; brand voice, tap sizes, and phone layouts hold up.
- The database keeps the page's promises: removal limited to what the window lists, the 10-day cut-off, Account Host contact and full-team checks limited and tested.

## Limits

An AI review of screenshots and code. Coverage was short of the brief for three reviewers (Product Owner, UX Designer, Software Engineer opened fewer dark or phone shots); the UI Designer and consultant opened all 96. Before launch, have two or three Account Hosts try inviting, removing, and re-inviting on a phone.
