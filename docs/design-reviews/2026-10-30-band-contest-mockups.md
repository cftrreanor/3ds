# Design review: band contest setup and the run-up to contest day

| | |
|---|---|
| **What was reviewed** | 10 mock-up screens, 60 screenshots (`2026-10-30-band-contest-mockups/`): new contest step 1 (Details), Registration (empty and filled), Publish (not ready and ready), right after publishing (Get the word out), the Invite directors window, the event page while registration is open, the event page after it closes, and volunteer jobs in a band contest |
| **Stage** | Mock-ups before building |
| **Size** | Full panel: Product Manager, Product Owner, UX Designer, UI Designer, Software Engineer, UX Content Manager, Marketing Manager, and the consultant |
| **Date** | 2026-10-30 |
| **Not reviewed** | The schedule builder, finals and revealing finalists, contest-day check-in screens, directors' own pages, the public event page, email wording, pricing |

## The consultant's verdict

**Build after fixes.** The three short setup steps, "Not ready to publish yet" with one clear fix, and the "When you publish" list are strong. Every reviewer flagged the Invite directors window. The change that would help most: an always-visible list of the event's sections on the event page (Bands, Schedule, Check-in stops, Volunteer jobs, Team, Event settings), each with a status line, so nothing is reachable only through a warning.

## Blocks people (severity 3)

Nothing here gets built until the owner decides.

### 1. Invite directors: you can't see or control who gets emailed · 8 of 8
- **Where:** 07, the list, "and 14 more", and "Send 17 invitations"; 08 "Invite more directors"
- **What happens:**
  - Only 4 of 18 rows show, and "and 14 more" can't be opened, so 14 people get an email the host never saw.
  - Nothing marks who was already invited. Sending again replaces each director's link, so the button in their first email stops working.
  - The real list is every director from every earlier event in the account, so it can run to hundreds.
  - School names float far from their checkboxes, and checked boxes have no tick.
  - "Already registered" shows while the page says 0 bands.
- **Who it hurts:** The organizer, who can't take an email back, and band directors, who get double emails and dead links.
- **Suggested fix:**
  - Show every row in a scrolling list, with a search box over 20 rows, "Choose all / Choose none", and "N of M chosen".
  - Mark "Invited Mar 2" and "Registered", and leave both unticked.
  - Re-sending keeps the director's existing link working.
  - Put each name right next to a standard checkbox, and make the whole row the tap target.
  - Add a close button and a confirmation after sending ("Sent to 17 directors").
- **Decision:**

### 2. The "Anyone else?" paste box would email sign-in links to any typed address · Software Engineer
- **Where:** 07, "Anyone else? Paste email addresses"
- **What happens:** Today pasted addresses are silently dropped. Making them work as drawn would send a one-tap sign-in link to any address, typos included. It would also let anyone send our email to any list, which hurts delivery for every customer.
- **Suggested fix:** Remove the box and link to the spreadsheet import, which already exists, checks each director, and makes them invitable. The alternative is sending pasted addresses a plain link with no sign-in, with limits, but that is a week of work.
- **Decision:**

### 3. A first-time host has no "get the word out" path · 4 of 8
- **Where:** 06 and 07. The mock-ups only show "18 directors from last year are on file".
- **What happens:**
  - Most pilot hosts run their first contest here and have no past directors, and no screen shows what they'd see.
  - The data doesn't link events year to year: the list is "directors from your earlier contests", not "last year's Lone Star".
  - The spreadsheet import the website promotes is buried in More options.
- **Who it hurts:** The organizer at a laptop and the busy PTO president.
- **Suggested fix:**
  - With no history, show "Have last year's director list? Import it and invite them in one step", with an Import directors button.
  - Keep Copy link and QR code either way.
  - Relabel the list "directors from your earlier contests", grouped by event.
- **Decision:**

### 4. Volunteers have no way to share their sign-up, and no place in the four stages · 3 of 8
- **Where:** 06, 08, 09, and 10
- **What happens:**
  - "Get the word out" covers directors only.
  - Volunteers appear only as a warning row or a count.
  - The jobs page has a preview but no link to copy, and opens with "Optional".
- **Who it hurts:** The organizer and the PTO president, who can't staff the contest, and volunteer parents, who never get the link.
- **Suggested fix:**
  - Add a Volunteers row to "Get the word out" (Copy link, QR code).
  - Add a standing Volunteers card on the event page ("6 of 20 spots filled", Copy volunteer link, Edit jobs).
  - Put Copy volunteer link in the jobs page header, and drop "Optional".
- **Decision:**

### 5. The event page has no standing way back to the event's parts · 3 of 8
- **Where:** 06, 08, and 09
- **What happens:** Volunteer jobs, team, maps, and Event settings are reachable only through warning rows or the pre-publish links. Once the warnings clear, a returning host has no route to them.
- **Suggested fix:** The consultant's top change: a section list that is always on the event page, each with a status line.
- **Decision:**

### 6. Hosts can't start from last year's contest · Product Manager
- **Where:** 01
- **What happens:** Most hosts run the same contest every year, but step 1 makes them retype everything: venue, times, classifications, director information, jobs, and check-in stops.
- **Suggested fix:** When the account has an earlier band contest, step 1 offers "Start from Lone Star Marching Invitational 2026" or "Start blank":
  - It copies everything except dates, which move forward a year and must be confirmed.
  - Copied fields are marked "From last year" until changed.
  - This is a new project, not part of the first build.
- **Decision:**

### 7. Dark mode: empty boxes look filled in · 2 of 8 (mock-ups only)
- **Where:** 02, 03, and 07 in dark mode: placeholder text is pure white, the same as typed answers
- **What happens:** In dark mode, the empty "Information for directors" box looks finished, so the host could publish with no entry fee or bus parking information.
- **Note:** In the real app, placeholders use the browser's own dimmer color, so this is a mock-up issue. Long example text ("Entry fee and how to pay…") should still become a hint under the label, so an empty box looks empty.
- **Decision:**

### 8. Registration's automatic saving needs to be built differently, with its saving and failed states shown · 2 of 8
- **Where:** 02 and 03, the bottom bar shows only "Saved"
- **What happens:**
  - Today's settings save as one form and reject it if anything is missing, so the first thing typed into an empty form would fail.
  - Two co-hosts editing the classifications at once would overwrite each other.
  - Neither "Saving…" nor "Couldn't save" is shown.
  - A classification typed but not added shows "Saved" while it's lost.
- **Suggested fix:**
  - Save one field at a time, and leave "at least one classification and a deadline" to the publish check.
  - Add and remove classifications one at a time.
  - Show the same states as the volunteer job editor: Saving, Couldn't save (Retry), and "typed but not added", with a warning before leaving.
  - Add a classification on Enter, on a comma, or when the box loses focus.
- **Decision:**

### 9. Removing a classification after bands registered in it leaves them stuck · Software Engineer
- **Where:** 03, the × on each classification
- **What happens:** One tap removes "2A" while 3 bands are registered in it. Those bands then can't edit their registration, and the schedule groups them under a classification that no longer exists.
- **Suggested fix:**
  - The database refuses to remove a classification that bands use, with a matching security test.
  - The chip shows "2A · 3 bands", and its × becomes "Move bands…".
  - Make the × at least 32 px on phones.
- **Decision:**

### 10. The shared job editor drops check-in stops · Software Engineer
- **Where:** 10, and "Set check-in stops" on 08 and 09
- **What happens:**
  - In the app, a check-in stop (Parking, Check-in point, Warm-up, Gate) is a volunteer job with a stop type and a check-in order.
  - The volunteer-event editor has neither, so built as drawn a host can't make a stop, contest-day check-in has nowhere to start, and "Set check-in stops" has nowhere to go.
- **Suggested fix:**
  - For band contests, keep the stop choice in the job editor's More options, and keep the Check-in order tab.
  - Point "Set check-in stops" at it.
  - Combine warnings that are about the same job.
- **Decision:**

### 11. "Publish, open registration later" leads nowhere designed · 6 of 8 (severity 3 from 1)
- **Where:** 05, the second publish button
- **What happens:**
  - It never says when or how registration opens.
  - No screen shows that state.
  - Invite directors can't send until registration is open.
- **Suggested fix:** Either drop it for now (simplest), or make it "Publish, open registration on a date" with a date picker. In that case the event page shows "Opens Feb 1 · Open now", and Invite directors waits.
- **Decision:**

### 12. Closing and reopening registration aren't designed · 4 of 8 (severity 3 from 1)
- **Where:** 08, the red "Close registration now" link; 09 has no "Reopen"
- **What happens:** One tap closes registration with no confirmation shown, and the closed state offers no way to reopen, which the app has today.
- **Suggested fix:**
  - Rename it "Close registration early", with a confirmation stating the effect ("12 bands registered. New directors will see 'Registration closed.' You can reopen it.").
  - Add "Reopen registration", which asks for a new deadline, on the closed state.
- **Decision:**

## Should fix (severity 2)

- **"Needs attention" cries wolf** (6 of 8): a month out, check-in stops show as an amber alarm, and the same list is called "Before contest day" on the next screen. Use one name, keep it neutral, and add due dates ("Set check-in stops · by Mar 6"). Only things that block the current stage go amber. In the stage bar, a later stage that needs something gets a ◆ and text, not a filled bar like the current stage.
- **The schedule waits for registration to close** (3 of 8): hosts sketch the day early, and directors need their times 2 to 3 weeks out to book buses. Let Schedule open any time as a draft, show "Post times by Mar 6" from publishing on, and add an optional band limit.
- **"Check-in" and "Parking" each mean two things** (5 of 8): Check-in is a stage, a stop, and arriving, and Parking is both a stop and a volunteer job. Rename the stage "Check-in stops", start rows with their area ("Volunteers: Parking has no shifts yet"), and use example stops that aren't job names.
- **The three setup steps arrange the page three ways** (4 of 8): use one layout of back link, step bar, title, then card. Future steps stay plain text until they can be opened.
- **Step 2's "Next up" looks dead, but step 3 can still be reached** (4 of 8): keep it a normal button and let step 3 list what's missing. Mark Classifications with *.
- **Contact for directors** (4 of 8): three boxes with no labels. Add Name, Phone, and Email labels. Keep today's note that only registered directors and your team see them, since the host's personal mobile is shared.
- **Phone stage bar is cramped** (3 of 8): four columns wrap to 3 or 4 lines and break "Check-/in". On phone, show bars with names only, and one line for the current stage.
- **Job tabs won't hold a real contest's 8 to 12 jobs** (3 of 8): use a job list with status that opens each job. Keep one "Add a job" button. Move Delete job away from the main button, and replace it with "2 people signed up" when it can't be used.
- **Payment** (2 of 8): the example text points to a payment link that doesn't exist. Add an optional Payment link field now. Later, add a per-band "Paid" checkbox and a "3 bands haven't paid" line after the deadline.
- **Marching-only words** (Marketing): "Prelims" and the 1A–6A shortcut put off jazz and solo & ensemble hosts. Say "The schedule is grouped by these", and offer a second shortcut ("Divisions I–III").
- **Promises the app may not keep** (4 of 8): "directions" on publish (only an address was given), "the order is filled in for you" (today's builder sets times, not order), and "last year's" contest (see 3).
- **The deadline is written four ways** (Content): use one pattern, "Open through Mon, Mar 1".
- **"Post" versus "publish" for the schedule** (Marketing): keep "post" in the app, and change the website and the builder's intro to match.
- **Publishing needs a deadline and a classification, enforced in the database** (Software Engineer): reopening must also require a new deadline, and the publish card needs a state for "your plan doesn't include this".
- **Host-only cards** (Software Engineer): the stage bar, attention list, and invite controls show only to hosts. Days left count in the event's time zone.
- **Setup footers** (UI): use one pattern, with status on the left and one button on the right. Cap the pinned bar near 96 px on phones.
- **Step 1 opens with what's missing** (Marketing, Content): say "3 short steps, then you can publish. Add your team, maps, and volunteer jobs whenever you're ready."

## Polish (severity 1)

Sample data mismatches (Round Rock "registered" while 0 bands; 6 of 20 versus 6 of 14), "on file", stat labels that don't say what they count, a link that breaks at a hyphen, dialog backdrop in dark mode, right-pointing chevrons on "More options", en dash versus hyphen in times, "2 / 4" versus "2 of 4", success-measure events to log (time to publish, invite-to-registered rate, schedule posted 14+ days out).

## What's working well

- "Not ready to publish yet": one reason, one button, and "Everything else can wait" (every reviewer)
- The "When you publish" list, especially "Nobody is emailed"
- Three short setup steps that ask only for what blocks publishing
- The four stages follow how a contest really unfolds
- "No 2A bands yet. Invite more directors" turns the page into a helper
- Reusing last year's directors and the volunteer job editor, both of which already exist
- "Saved" is visible, status always has a word and not just a color, contrast passes in both modes, and buttons are 44 px tall

## By role

- **Product Manager:** start from last year's contest; a "post times by" date; fee tracking; success measures.
- **Product Owner:** missing states (no history, close and reopen, 0 bands, errors, unpublish); acceptance criteria are in the reviewer notes.
- **UX Designer:** invite list; volunteers outside the stages; draft schedule early; one layout across steps.
- **UI Designer:** checkbox and label layout; dark placeholders; stage bar weight on phones; tap targets on chips; footers.
- **Software Engineer:** paste box, re-sent links, stuck classifications, saving, check-in stops, database rules, host-only cards.
- **Content Manager:** "and 14 more", the many meanings of Check-in, deadline wording, required marks, labels.
- **Marketing Manager:** first-time host path, what invited directors get (no code, details filled in), marching-only words, "post".
- **Consultant:** build after fixes; an always-visible section list.

## Limits

This is an AI review of static mock-ups, not testing with real people. Before band contests go to real hosts, have two or three hosts set one up, invite directors, and build a schedule.
