# Design review: setup redesign mock-up, version 3 (light check)

| | |
|---|---|
| **What was reviewed** | Version 3 of the clickable mock-up: 21 screens (`2026-10-30-setup-redesign-mockup-v3/`, 126 screenshots), before the owner's follow-up renames (Fair or festival, Band competition, Group rotations) and the amber plan-ended banner |
| **Size** | Light check: Product Owner, UX Designer, UI Designer, Software Engineer, UX Content Manager, consultant |
| **Coverage** | UI Designer and consultant: all 126. Others: 63 each |
| **Date** | 2026-10-30 |

## The consultant's verdict

**Build after fixes. Nothing needs a rethink.** "The structure, the order of steps, and the way the rules are explained are sound." The one change that would help most: one automatic save model across details, jobs, and live edits, with a status line that never says "All changes saved" while something is still open.

## Blocks people (severity 3–4)

1. **Hidden jobs aren't hidden in the database yet** (severity 4, Engineer). Add a `ready` flag, public and staff read rules, refusal at sign-up, an always-filtered public page, and a separate signed-in preview, with security tests. *Known since v1; this is the first build step.*
2. **Saving works three or four different ways** (5 of 6). Use one model: save each change automatically. Hidden or shown is a separate, deliberate choice. Honest status only: Saving, Saved, Couldn't save, or "1 change not saved yet".
3. **Saved with only a name conflicts with required columns** (Engineer, large). Make the date, times, and address columns optional, check them at publish, and give every reader of those columns a safe fallback. Only allow shifts once a date is set.
4. **"Try it" drafts are blocked by the database today** (Engineer). Allow drafts of every type, and keep the publish check as the gate. Trial events can't send outside invitations (bands, partners) until there's a plan.
5. **Ended conferences still count, and the plan's end date isn't stored** (Engineer). Count only conferences that haven't ended. Store `plan_ended_on`.
6. **Publishing needs a ready job, and hide needs sign-up protection, enforced in the database** (Engineer). Include item claims and group sign-ups, and lock rows so a sign-up and a hide can't race.
7. **Who can see and change a draft doesn't match the database** (PO, Engineer). Coordinators can read drafts today, the mock-up shows a Coordinator editing, and Volunteer Leads can't edit event details. *Needs owner decisions.*
8. **"Ready" means two things** (consultant, Content). The event is ready to publish, and a job is visible to volunteers. *Needs an owner decision: Ready/Hidden or Showing/Hidden.*
9. **Phone pages scroll sideways because of the Draft badge, and a badge spills out of its card on desktop** (UI, consultant). Shorten the badge to "Draft · Volunteers can't see it yet" and let badges wrap.
10. **Buttons you can't press look pressable in dark mode** (UI, consultant). Give them their own style that doesn't rely on grey text.
11. **A failed save looks like a successful one** (UI). Use the red note style with "Not saved.", announced to screen readers.
12. **Missing screens** (PO, UX):
    - Picking between a shifts job and a things-to-bring job
    - The "Later" result ("Sign-up not open yet")
    - Unpublishing after a plan has ended
    - Confirming a Move or a Remove
    - Picking a past event to copy
    - Publishing with details still missing
    - Changing a live shift's time and deleting shifts or jobs
13. **The Volunteer Lead's publish step is a dead end** (UX, consultant). Show "Ready for a Host to publish" with the full overview, and a way to ask a Host from inside the app.

## Should fix (severity 2)

- **The plan-ended screen talks to everyone the same way.** Show it by role: the Account Host gets "Email us", and everyone else gets "Ask Hana Patel".
- **Remove and Move need confirming.** Moving is a new database function: lock both shifts, keep groups together, send one email.
- **Unpublish dialog:** use one pair of words ("Unpublish" / "Keep it published"), say whether sign-ups are kept, and add a "Copy their emails" link.
- **Details shows "Done" with boxes still empty.** Show "2 left", and use asterisks only for what's needed to save.
- **The spots error should start with the fix.** Disable "Try again" while a box has an error.
- **"Check-in opens Fri 6 PM" would widen when Coordinators can see phone numbers.** Show the real rule, or split the two timers apart.
- **Publish and open sign-up should be one database step.**
- **Two people editing the same thing:** add `updated_at` and `updated_by`, refuse a stale save, and give each new shift its id on the phone so a retry can't add it twice.
- **Phone layout:** Close sign-up and Unpublish sit above Share, and the job list pushes the editor off-screen.
- **One filled button per view.** The lock icon should mean "needs a plan" only. The "Try it" badge should use a different color and icon from warnings.
- **Small row-action links on phones.** Use one row layout with 44 px targets.
- **"Start from a past event" should also be on the picker.** Copy in local time, and copy jobs as hidden with no Coordinators.
- **Multi-day and overnight shifts:** show "(next day)", and list shifts that fall outside the dates when an event gets shorter.
- **The link's short name** should be created at first publish and never change.

## Polish (severity 1)

- Dialog corner radius
- Link weights
- Alignment of the closed-state badge
- Page width jumping between steps
- "Closed by" has no data behind it
- The Content Manager's line-by-line rewrites (in the reviewer notes)

## Disagreement for the owner

- **Job state words:** "Ready / Hidden" with a "Mark ready" button (Content Manager), or "Showing / Hidden" with a "Show to volunteers" button (consultant). Either way, "ready" for the event ("Ready to publish") stays separate.

## Process note

The screenshot count grew from 48 (v1) to 90 (v2) to 126 (v3) because each round added states the reviewers asked for. That's 6 shots per screen.
