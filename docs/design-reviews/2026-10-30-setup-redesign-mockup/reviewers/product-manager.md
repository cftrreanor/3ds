# Product Manager

## Headline
This redesign solves the right problem for the organizer at a laptop and the PTO president: it gets a volunteer event from nothing to a shareable link in three clear steps, it's honest about the plan limit before anyone does any work, and it reuses last year's jobs. The weak spots are at the two moments that decide whether this pays off: the dead end when the plan blocks publishing (no real way to add a plan, and often the wrong person is looking at it), and the gap right after publishing, where the design stops helping just as the real goal (filled shifts) begins. The lead's preview also shows more than the fixed rule allows.

## Findings

### The "add a plan" path goes nowhere specific
- Where: 1 Type picker (banner, "See what's included"); 8 Plan doesn't allow publishing ("See what's included", "Talk with us"); all widths and modes
- What happens: Both screens say "publish it once you add a plan", but neither has an "Add a plan" action, a price, or who to ask. The main button on screen 8 is "See what's included", which is information, not the next step. Today's app has no self-serve billing (the dashboard tells people to email support), so "add a plan" promises something the product can't do in one step. Also, the person who hits this wall is often not the person who can spend money (a PTO president needs the treasurer or principal to approve it).
- Who it hurts: Organizer at a laptop and PTO president. They finish setup, hit the wall, and don't know what to do next or how long it will take. This is the moment most likely to produce a support email or an abandoned event, and it's also our main revenue moment.
- Standard: Action over information; heuristic 9 (help users recover); heuristic 1 (status)
- Severity: 3
- Suggested fix: Make the main button on screen 8 say what really happens, for example "Ask about a plan" that opens a short prefilled request (event name, date, account) sent to us, with "We'll reply within 1 school day" under it. Add a second action, "Send this to whoever approves it", that produces a short note and link the organizer can forward to a treasurer or principal. Show the price or "from $X" if we're allowed to. After a request is sent, change the banner to "Plan requested Oct 30. We'll email you" so the organizer knows it's handled when they come back.

### The lead's preview would show other jobs' drafts
- Where: 5 Preview; 4 Editing a job (draft banner: "You and its lead can preview it")
- What happens: The fixed rule is that a draft job can be previewed by Hosts and *that job's* lead. The only preview shown displays every draft (Face painting and Bake sale items) outlined. There is no version showing what Maria Lopez, lead of Face painting, would see, and nothing says how she finds out she can preview it.
- Who it hurts: Organizer at a laptop (trusts that drafts stay private, and may have unfinished or sensitive jobs in draft). The lead (gets confused seeing jobs that aren't hers, or never knows the preview exists).
- Standard: Fixed product rule on draft visibility; heuristic 1
- Severity: 3
- Suggested fix: Add a lead's version of screen 5: only her own draft is outlined, other drafts are left out entirely, and the banner reads "Preview only. Only you and the event's Hosts can see Face painting until it's marked ready". Decide and show how the lead gets there (a link in the "you're a lead" email, or a "Preview my job" link on her event list).

### No way forward from Jobs and shifts to Publish
- Where: 4 Editing a job, save bar; all widths
- What happens: The save bar offers "Save as draft" and "Save and mark ready" for the current job, but nothing takes the organizer to step 3. Screen 3 has no forward button either. The only way to reach Publish is unclear (the back link "Cedar Ridge Fall Festival", maybe).
- Who it hurts: Organizer at a laptop and teacher with 30 minutes, who finish their jobs and then don't know how to get to the step that matters. Directly slows "time to publish", which is the main thing this redesign should improve.
- Standard: Heuristic 1 (where am I, what's next); Action over information
- Severity: 3
- Suggested fix: Once at least one job is ready, add a clear "Continue to publish" next to the job's save buttons (or above the job tabs), with the running count "1 job ready · 2 drafts" beside it. Keep the job save buttons as the per-job actions.

### "You can publish this" may be false, and "pilot" contradicts "free period ended"
- Where: 1 Type picker, Parent-teacher conferences card; all widths and modes
- What happens: The card says "You can publish this" and "Free during the pilot, one published at a time", right under a banner saying the free period ended. "Pilot" is our internal word. And the rule is one conference event at a time, but the card doesn't know or say whether one is already live, so for an account that already has conferences published the green "You can publish this" badge is wrong.
- Who it hurts: Teacher with a 30-minute lunch, who sets up conferences, then can't publish and doesn't know why. Organizer at a laptop, who reads "pilot" and "ended" and isn't sure what's free.
- Standard: Fixed plan rule (one at a time); content standard "plain words" and "same thing, same word"
- Severity: 3
- Suggested fix: Make the card state-aware. With no live conference: "You can publish this · Included, one at a time". With one already live: "Set up now. Publish when [Spring conferences] ends or is unpublished", with a link to that event. Drop "pilot" everywhere the organizer can see it.

### Sample numbers say people signed up before publishing
- Where: 4 Editing a job (Parking: "2 of 4 spots filled"); 5 Preview ("2 spots left"); 7 Just published ("0 of 24 spots filled")
- What happens: Before the event has ever been published, Parking already shows 2 people signed up. After publishing, the event says 0 of 24 filled. Either organizers can add people to shifts before publishing (a feature nobody has described), or the numbers are wrong. The panel note "Shifts with people in them can't be deleted" only makes sense if that feature exists.
- Who it hurts: Organizer at a laptop, whose main worry is "can anyone see this yet". Seeing names on shifts while in Draft suggests it's already live.
- Standard: Heuristic 1 (status); heuristic 4 (consistency)
- Severity: 2
- Suggested fix: Decide whether organizers can pre-fill shifts (for example, adding the PTO board themselves). If yes, show it as "2 added by you" so it can't be mistaken for public sign-ups, and carry the same count to screen 7 ("2 of 24 spots filled"). If no, use "0 of 4" in the mock-up and remove the "can't be deleted" note from the setup step.

### The side panel on screen 4 shows a different job than the one being edited
- Where: 4 Editing a job, the "Parking" panel (right side on desktop, below the form on tablet and phone)
- What happens: The organizer is editing Face painting, but the panel shows Parking's shifts with Edit and Delete links. On phone and tablet it sits under the Face painting form with no heading, so it reads as part of Face painting.
- Who it hurts: PTO president on a phone, who may edit or delete the wrong job's shift. Organizer at a laptop, who has to work out why it's there.
- Standard: Heuristic 8 (only what helps now); heuristic 4
- Severity: 2
- Suggested fix: Show the current job's shifts in that space (for Face painting, the empty state and "Add a shift"). If an overview of other jobs is wanted, the job tabs already do that; drop the panel.

### Blocked organizers lose the useful "before the day" work
- Where: 8 Plan doesn't allow publishing, compared with 6 Ready to publish; all widths
- What happens: Screen 8 drops the "Before the day" list (invite your team, add maps, daily email), the Event settings button, and the note about the hidden draft job. The organizer who is waiting on a plan has the most time to do this prep, but the screen gives them nothing to do except read about plans.
- Who it hurts: PTO president, who wants to hand jobs to other parents while the money question is sorted out. It also makes the plan wall feel like a full stop, which raises the chance they abandon the tool.
- Standard: Action over information; heuristic 3 (control and freedom)
- Severity: 2
- Suggested fix: Keep screen 8 the same as screen 6 apart from the plan banner and the disabled publish button. Keep "Before the day", Event settings, and the draft-job line.

### After publishing, the design stops at "share the link"
- Where: 7 Just published; all widths
- What happens: The real goal is filled shifts. Screen 7 gives a link, a QR code, and a count. There's no ready-to-paste message for a group text, no way to reach last year's volunteers (the system knows Spring Carnival 2026 exists, per screen 3), and no sense of what "good" looks like (for example, how many days are left before the event).
- Who it hurts: PTO president and organizer at a laptop, who have to write the message themselves, often on a phone in the car line. Volunteer parents get a bare link with no context.
- Standard: Heuristic 7 (efficiency, reuse last year); Action over information
- Severity: 2
- Suggested fix: Add "Copy a message" with a short prefilled text ("Cedar Ridge Fall Festival needs volunteers Sat, Nov 14. Pick a shift here: [link]") next to Copy link. Consider a later, separate item: "Invite Spring Carnival volunteers" (needs its own rules about who may be emailed). Under the count, show "16 days until the event".

### "Keep sign-up closed for now" adds a decision at the riskiest moment
- Where: 6 Ready to publish, checkbox above the publish button; all widths
- What happens: Right before publishing, the organizer has to decide whether the page should be online but closed. The screens don't show who needs this, whether the button's words change when it's ticked, or how they open sign-up later.
- Who it hurts: Organizer at a laptop and teacher with a short lunch, who are now unsure which option is "right" and may tick it by accident, then wonder why nobody signs up.
- Standard: Heuristic 8 (only what helps now); heuristic 5 (error prevention)
- Severity: 2
- Suggested fix: Unless there's a clear request for it, move it to Event settings. If it stays, change the button to "Publish, sign-up closed" when ticked, and on screen 7 show a "Sign-up closed · Open sign-up" state with the button.

### Account (and so the plan) is missing from the phone menu
- Where: Top bar on every screen at phone width, light and dark (shows "My events" and "Volunteer tracking" only)
- What happens: At 390 px the "Account" link isn't there, and there's no menu button to reach it. That's where a plan would be managed.
- Who it hurts: PTO president, who does most of her work on a phone and can't get to her account or plan from this flow.
- Standard: Heuristic 4 (consistency across widths)
- Severity: 2
- Suggested fix: Keep Account reachable on phone, through a menu button if space is tight.

### No way to tell if the redesign worked
- Where: Whole flow
- What happens: The design is aimed at faster setup, fewer "is it live?" questions, and more upgrades, but nothing in it defines what we'll count. Without that, we can't compare it with the current setup.
- Who it hurts: The owner, who can't judge whether this was worth building or where people get stuck.
- Standard: none
- Severity: 2
- Suggested fix: Before building, agree on a few counts and record them: (1) time from the type picker to publish, and the share of events started that are published within 7 days; (2) where unpublished events stop (step 1, step 2, or the plan wall); (3) how often "Copy jobs" is used; (4) clicks on the plan actions from screen 1 and screen 8, and how many become paid plans; (5) spots filled 7 days after publishing; (6) support emails that mention "draft", "can't see", or "publish". Compare with the current flow for one month.

## Working well
- Telling the organizer about the plan limit on the type picker, before any work, and still letting them set up any event ("Set up now, publish with a plan"). Nobody loses work.
- "Start from a past event · Copy jobs" on the empty jobs screen. This directly serves the PTO president's "reuse last year".
- The "When you publish" list on screen 6, especially "Nobody is emailed" and "You can unpublish at any time". It answers the organizer's biggest worry before they click.
- Draft jobs are clearly labeled in the editor, in the preview ("volunteers won't see this"), and after publishing ("Needs you: Bake sale items is still a draft"). The draft rule is visible end to end.
- The three-step bar with "Next, you'll add volunteer jobs and shifts" and "2 boxes left: Starts and Ends" makes it easy to pick up where you left off.
- Pushing team, emails, and maps to "Before the day" as optional keeps the first sitting short enough for a teacher's lunch.

Screenshots opened: 1-picker-desktop, 1-picker-desktop-dark, 1-picker-tablet, 1-picker-phone, 2-details-desktop, 2-details-phone, 3-jobs-empty-desktop, 3-jobs-empty-phone, 4-job-edit-desktop, 4-job-edit-desktop-dark, 4-job-edit-tablet, 4-job-edit-phone, 5-preview-desktop, 5-preview-desktop-dark, 5-preview-phone, 6-ready-desktop, 6-ready-desktop-dark, 6-ready-tablet, 6-ready-phone, 7-live-desktop, 7-live-desktop-dark, 7-live-phone, 8-blocked-desktop, 8-blocked-tablet, 8-blocked-phone, 8-blocked-phone-dark (not opened: the other tablet and dark variants of screens 2, 3, 5, and 7, and the remaining phone-dark shots)
