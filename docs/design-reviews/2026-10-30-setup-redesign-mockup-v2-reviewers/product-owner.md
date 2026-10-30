# Product Owner

## Headline
The main path (pick the event type, add details, add jobs, publish) is close to the smallest version that does the job, and the three fixed rules can all be seen in it. It is not ready to build yet. Screen 02 is broken and doesn't say what the user can do there. Who can preview a hidden job is described three different ways. The plan rule reads differently on 01, 10, 12, and 15, so two builders could ship different products. Several states that a builder will certainly reach are not drawn: the confirm steps before closing sign-up or unpublishing, after the event, a save that fails, and a spots number below the minimum.

## Findings

### 02 picker-conf is broken and its rules are unclear
- Where: 02 picker-conf, all widths, light and dark
- What happens: Only two of the seven event types appear. "Go to Fall conferences" and "Set up →" are loose text outside the cards: at desktop they sit in the gaps between cards, and at tablet and phone they sit under the conference card. The pilot banner from 01 is gone. On the Volunteer event card, the "Publishing needs a plan" badge has no lock icon here, but it does on 01. You can't tell whether "Set up →" lets you start a second conference while one is live.
- Who it hurts: Teacher with a 30-minute lunch, who comes back to start spring conferences, can't tell whether she may set one up now. The builder would have to guess.
- Standard: Consistency and standards (4); Visibility of system status (1)
- Severity: 3
- Suggested fix: Redraw 02 as 01 with one change. The conference card keeps the badge "Fall conferences is live" and offers two actions inside the card: "Set up another (publish later)" and "Go to Fall conferences". Show all seven cards and keep the pilot banner.

### Who can preview a hidden job is described three ways
- Where: 06 job-edit hidden banner ("Your Hosts, Volunteer Directors, and this job's lead"); 09 preview-lead banner ("Only you and the event's Hosts"); 05/10/11/15 badge ("Draft event: only your team can see it")
- What happens: The fixed rule is Hosts, Co-hosts, Volunteer Directors, and that job's lead. 06 leaves out Co-hosts. 09 leaves out Co-hosts and Volunteer Directors. "Your team" is a third, vaguer version. Each screen tells the lead or organizer a different privacy story.
- Who it hurts: Busy PTO president who hands a job to another parent and needs to know who else sees it. A builder could also wire the permissions to whichever wording they read.
- Standard: Same thing, same word (content); Consistency (4)
- Severity: 3
- Suggested fix: Pick one sentence and use it everywhere: "Hosts, Co-hosts, Volunteer Directors, and this job's lead can preview it". Use it on 06, 07, and 09. The draft badge can say "Draft: only your event team can see it", where "event team" means that same list. Add a test case for each role.

### The plan rule tells a different story on each screen
- Where: 01 badge "Publishing needs a plan" on Volunteer event; 10 ready (no plan notice, Publish is active); 12 live ("Your plan can't publish volunteer events"); 15 blocked ("Without a plan…")
- What happens: 01 and 15 say a volunteer event can't be published without a plan. 10 shows the same kind of event with Publish active and no explanation. 12 says "your plan", which suggests the account has a plan, while 15 says "without a plan". Nothing shows which account state leads to 10 and which to 15.
- Who it hurts: Organizer at a laptop, who sees "needs a plan" on 01 and then can or can't publish with no reason given. Builders will disagree about when 10 shows and when 15 shows.
- Standard: Visibility of system status (1); Consistency (4)
- Severity: 3
- Suggested fix: Write down the rule as: publish is active only if the account has a plan or the event is the one allowed conference. Label 10 "account with a plan" and 15 "account without a plan". On 12, change the text to "Without a plan, you can't publish volunteer events again. If you unpublish this one, it stays offline until you add a plan." On 10, show a small line saying which plan allows publishing.

### No confirm step or after-state for Close sign-up and Unpublish
- Where: 12 live, "Close sign-up" and "Unpublish"; 13 live-closed
- What happens: Unpublish takes the page offline for 2 signed-up volunteers. For this account it also can't be undone without a plan. No confirm step, no message to volunteers, and no "unpublished" screen is drawn. 13 shows sign-up closed, but its wording ("can't sign up yet") only fits closing before sign-up ever opened. It doesn't fit closing it after people signed up.
- Who it hurts: The organizer, who could take a live event offline for good with one tap. Volunteer parents, whose link stops working.
- Standard: Error prevention (5); User control and freedom (3)
- Severity: 3
- Suggested fix: Add a confirm screen for Unpublish. It names how many people are signed up, says the event can't be republished without a plan, and uses the buttons "Unpublish event" and "Keep it online". Add a confirm screen for Close sign-up. Draw the unpublished state. Write 13's text for both ways of getting there: "Sign-up is closed. People can see the event but can't sign up."

### 13 live-closed has lost the rest of the live page
- Where: 13 live-closed, all widths
- What happens: Compared with 12, these are gone: Event settings, the place, the volunteer count, Manage jobs and shifts, Unpublish, Before the day, and What happens next. The organizer can only reopen sign-up or copy the link.
- Who it hurts: Organizer and PTO president, who closed sign-up to fix something and now can't reach the jobs or see who signed up.
- Standard: Consistency (4); Recognition rather than recall (6)
- Severity: 3
- Suggested fix: Make 13 the same as 12. Swap only the green "Your event is live" panel for the closed panel, and change the side row to "Sign-up is closed · Open sign-up".

### "Move or remove people" leads nowhere
- Where: 14 job-live, "To delete this shift, move or remove the 2 people signed up first" and the note under the disabled "Hide this job"
- What happens: The rule is enforced, but the design gives no way to see the 2 people, move them, or remove them. On this screen it's a dead end.
- Who it hurts: The organizer, who needs to change a shift on short notice. The volunteer, who could be removed without being told.
- Standard: Help users recover (9); a loose end
- Severity: 3
- Suggested fix: Make "2 signed up" a link that opens the sign-up list for that shift, with "Move to another shift" and "Remove" for each person. Show what the volunteer is told. If that's out of scope for v1, say "Write to them, then remove them in Volunteer tracking" and link there.

### Missing states
- Where: whole flow
- What happens: These states aren't drawn: (a) save failed or offline while editing a job or details; (b) a spots number below the number signed up on 14 (the hint "At least 2" is there, but no error); (c) after the event (12 after Feb 6); (d) a shift whose spots are all taken, and an event that is fully booked; (e) what "Copy jobs and shifts" leads to (05), and what happens if no past event exists; (f) a lead accepting or declining the invite after "Maria Lopez · Invited" (06); (g) the "Later" choice on 10: what the button says and where you land; (h) preview as a Co-host or a Volunteer Director; (i) changing a shift's times when people are signed up (14 only lets you edit spots); (j) deleting a whole job.
- Who it hurts: All organizer personas. Builders will make up their own version of each.
- Standard: Visibility of system status (1); Error prevention (5)
- Severity: 3 for (a), (b), (g), and (i); 2 for the rest
- Suggested fix: Draw at least (a), (b), (g), and (i) before building. Write one line each for the others.

### 04 details-errors doesn't match 03
- Where: 04 details-errors, all widths
- What happens: The step bar and the Date, Time zone, and Where fields are gone, so it isn't the same form with errors on it. The "stays on this device" draft note appears only on 04. The banner says "Add 2 more things to save this event", which means nothing is saved until the form is complete. 03 says "You can change everything later" but doesn't mention saving.
- Who it hurts: Teacher and PTO president, who stop halfway and need to know whether their work is kept.
- Standard: Consistency (4); Interruption-proof
- Severity: 2
- Suggested fix: Draw 04 as 03 with the error styling. Decide the save rule: either save a draft as soon as there's a name, or keep it on the device. Show the same one-line note on 03 and 04.

### The sample numbers don't add up
- Where: 08 vs 09 (Parking has 2 shifts vs 1); 10 and 15 ("2 jobs, 4 shifts, 20 spots", while the jobs drawn have 3 shifts and 14 spots); 12 "2 of 20 spots filled" vs 14, where Parking alone has 2 signed up
- What happens: Reviewers and builders can't tell whether a lead sees only some shifts, or whether the counts include hidden jobs.
- Who it hurts: Builders; the owner checking the counting rules
- Standard: none (mock-up accuracy)
- Severity: 2
- Suggested fix: Use one data set on every screen. State the rule plainly: the counts include only jobs that are ready.

### A setting that shows its state but can't be changed
- Where: 10 ready, "Daily email of new sign-ups: On, sent to you"; it's missing on 12 and 15
- What happens: It looks like a setting but has no control, and it disappears after you publish. 12's "What happens next" mentions the morning email but gives no way to turn it off. 10 at tablet and desktop also shows Event settings twice (a button and a row).
- Who it hurts: Organizer, and a PTO president who doesn't want daily email
- Standard: a loose end; Consistency (4)
- Severity: 2
- Suggested fix: Make the row "Daily email of new sign-ups · On · Change" (it goes to Event settings), and show it on 10, 12, and 15. Drop either the Event settings button or the Event settings row.

### Job editing looks different on each screen
- Where: 06 (step bar plus "1 job is ready" banner and save bar); 07 and 14 (no step bar and no banner); 14 (no check-in place, no lead, no save bar, and no sign that the job is live)
- What happens: You can't tell whether 07 and 14 are the same page in a different state or a different page. On 14 you can't edit the lead or check-in place, and nothing says that edits reach volunteers right away.
- Who it hurts: Organizer, who doesn't know whether a change to a live job goes out to volunteers straight away
- Standard: Consistency (4); Visibility of system status (1)
- Severity: 2
- Suggested fix: Use one job page with the same parts in every state. On a live job, add a note at the top: "This job is live. Changes show to volunteers as soon as you save." Keep the lead and check-in fields.

## Acceptance criteria
- Given an account without a plan after the pilot, when it opens the picker, then every type except conferences shows "Publishing needs a plan" and can still be set up
- Given a live one-time conference, when the user opens the picker, then the conference card says one is live, links to it, and says whether another can be set up but not published
- Given an account without a plan and a ready volunteer event, when the user reaches Publish, then the publish button is turned off, the reason and the "write to us" address are shown, and nothing already entered is lost
- Given a user who isn't the Account Host, when they see the plan notice, then it names the Account Host to ask
- Given a job not marked ready, when a volunteer opens the sign-up page, then the job doesn't appear at all
- Given a job not marked ready, when a Host, Co-host, Volunteer Director, or that job's lead previews, then they see it with a dashed outline, a "Hidden from volunteers" label, and a "Preview only" bar with a way out
- Given a lead previewing, when other hidden jobs exist, then the lead sees only their own and a note that others aren't shown
- Given any other team member (not a lead of that job, and not a Host, Co-host, or Volunteer Director), when they preview, then hidden jobs aren't shown
- Given a job with a shift, or with at least one item, when the organizer taps "Mark ready", then the job is ready. Given a job with neither, "Mark ready" is turned off and "What's left" says why
- Given a job with at least one sign-up, when the organizer tries to hide it, then "Hide this job" is turned off and the note says how many people are signed up and how to move them
- Given a shift with N sign-ups, when the organizer enters spots below N, then it doesn't save and an error next to the field says "At least N, the number signed up"
- Given a shift with sign-ups, when the organizer looks for Delete, then it isn't offered and the note explains why. Given a shift with no sign-ups, Delete is offered
- Given no job is ready, when the organizer opens the event, then Publish is locked and the main action is "Go to jobs and shifts"
- Given "Later" is chosen, when the organizer publishes, then the page goes online with sign-up closed and lands on the sign-up-closed state with "Open sign-up"
- Given a live event, when the organizer taps Unpublish, then a confirm step shows the sign-up count and whether the event can be republished
- Given a live event, when the organizer closes sign-up, then the live page keeps every other section and shows "Open sign-up"
- Given the organizer leaves the details step half done, when they come back on the same device, then what they typed is still there
- Given copied jobs from a past event, when they arrive, then each one is hidden until it's marked ready
- Every screen above works at 390, 820, and 1440 px wide, in light and dark

## Working well
- Three clear steps, with "Next, you'll…" and "Last step: publish". It's easy to see what's done and what's left (03, 10, 11)
- "What's left: add a shift" and "Ready to show volunteers" in the save bar tell the organizer what "done" means for each job (06, 07)
- The rule against hiding a job with sign-ups is enforced, with the reason shown right there (14)
- 15 keeps the work, says "Everything here is saved", names the Account Host, and offers things to do while waiting. That's honest and doesn't lose work
- "Start from a past event", with copies arriving hidden, covers reuse without risk (05)
- The preview is clearly a preview: a persistent "Preview only" bar, dashed outlines, and "Opens when published" in place of sign-up buttons (08, 09)
- 11 replaces a dead Publish button with the next real step

Screenshots opened: 01–15 desktop (light), 01–15 phone (light), 01–15 tablet-dark (45 in all).
