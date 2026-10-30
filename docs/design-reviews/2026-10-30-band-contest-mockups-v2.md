# Design review: band contest setup, revised mock-ups (light check)

| | |
|---|---|
| **What was reviewed** | 14 revised mock-up screens, 84 screenshots (`2026-10-30-band-contest-mockups-v2/`), after the owner's decisions on the first panel |
| **Stage** | Mock-ups before building |
| **Size** | Light check with all eight roles (each raised a finding in the first round) |
| **Date** | 2026-10-30 |

## The consultant's verdict

**Build after fixes.** The flow, its order, and the copy are sound. The change that would help most: every status on the event page comes from one live source, and copies that only repeat it are dropped.

## Blocks people (severity 3)

1. **The event page's numbers disagree** (8 of 8): "0 bands" in the stage bar next to "12 registered" on a card; "Closed · 24 bands" next to "open through Mar 1". Mostly the mock-ups' sample data, but the design repeats the same facts three or four times. **Fix:** "Your contest" cards become navigation with one neutral fact each; status lives in the stage bar and the main card; one source for every count.
2. **Check-in stops live in two places that disagree** (3 of 8): the event page says "not set" while jobs already show "Check-in stop: Parking". **Fix:** one Check-in stops page (the stops in order, each staffed by a volunteer job); the job editor shows the link.
3. **A failed save still lets the host move on** (4 of 8): "Next up: Publish" leaves with the deadline unsaved, and only the bottom bar says so. **Fix:** finish or retry saves before leaving, stay if one fails, and mark the field itself.
4. **Dark mode: white text on the red "Close registration" button is 2.3:1** (2 of 8). **Fix:** dark text on red buttons in dark mode, one shared color.
5. **Invitation links stop working after 7 days** (Product Owner; 2 more at severity 2): the one-tap sign-in in an invitation lasts a week, but registration runs for months. **Needs a decision.**
6. **Rules the server must enforce** (Software Engineer): publishing needs a deadline and a classification; a classification with bands can't be removed; co-hosts editing at once must not undo each other; reopening needs a deadline.
7. **The volunteer link is offered before any jobs exist** (UX; 4 more at severity 2). **Fix:** "Add jobs first" until a job has open spots.

## Should fix (severity 2)

- A hint under the deadline showing what it leads to ("Post the schedule by Fri, Mar 6"), and why check-in stops are due then
- Closing early: mention the invited directors who haven't registered, and that registered directors can't edit while closed
- "Send a reminder" to invited directors who haven't registered
- "Sent" only after sending; show which invitations couldn't be delivered
- "Invite 2A directors" needs data the app doesn't keep (drop the link or add last classification)
- The director contact must be saved even if the host accepts the suggestion
- The database fills in 1A–6A for new contests today (**needs a decision**)
- Entry fee "Paid" tracking (**scope decision**)
- Status words disappear from the step bars on phones (color only)
- Volunteer spots stay on the "Before contest day" list while any are open
- Wording: "one tap" and "one step" overpromise; three names for import; mixed date formats; time zone on 11:59 PM
- Small tap targets on phones; dropdowns drawn as text boxes; light placeholder contrast 4.2:1
- Import as the main action needs sending limits and an unsubscribe

## Working well

Three short honest steps; "Everything else can wait"; the "When you publish" list; "Get the word out"; the invite window's plain promises; "No 2A bands yet" with a next step; classifications that can't be removed while in use; reusing the job editor; calm tone, no exclamation points, Oxford commas.

## Limits

An AI review of static mock-ups. Before band contests go to real hosts, have two or three hosts set one up and invite directors.
