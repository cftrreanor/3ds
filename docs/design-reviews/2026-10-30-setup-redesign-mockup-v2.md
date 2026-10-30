# Design review: setup redesign mock-up, version 2 (light check)

| | |
|---|---|
| **What was reviewed** | Version 2 of the clickable mock-up: 15 screens (`2026-10-30-setup-redesign-mockup-v2/`, 90 screenshots) |
| **Stage** | Mock-ups, before building |
| **Size** | Light check: Product Owner, UX Designer, UI Designer, Software Engineer, UX Content Manager, and the consultant (the roles that raised the findings fixed in version 2) |
| **Coverage** | UI Designer and consultant: all 90. Others: 45–46 each (every screen at phone and desktop, plus one dark shot per screen) |
| **Date** | 2026-10-30 |

## The consultant's verdict

**Build after fixes.** "The structure, the preview model, and the live-edit rules are right and don't need rethinking." The one change that would help most: show the plan state in the step bar's Publish step from the first setup screen ("Publish · Needs a plan"), with a way to write to us right there. That way no organizer spends an evening building an event they can't publish.

## What version 2 fixed (confirmed by reviewers)

- **One job at a time:** the job editor shows only the job you're editing.
- **A clear next step:** there's a path from jobs to publishing.
- **Spot rule:** "At least 2, the number signed up" carries out the owner's rule well, and hiding or deleting is locked with the reason shown.
- **Errors at the field:** required-field errors sit next to each box, in both modes.
- **Preview is clearly a preview:** the banner, the dashed outlines, and the "Opens when published" buttons make that plain.
- **"Plan doesn't allow" screen:** it keeps your work, names the Account Host, and offers things to do while you wait.
- **Choosing "nothing ready yet":** the screen replaces a dead Publish button with the next real step.

## Blocks people (severity 3)

### 1. Screen 1b (a conference is already live) is broken, and its advice is risky · 6 of 6
- **What happens:** the links fell outside the cards, five event types and the banner are missing, and the badge tells a teacher to "Unpublish it", which could take down a conference families are booking.
- **Engineer's catch:** the one-at-a-time count includes conferences that already ended.
- **Fix:**
  - Redraw it as screen 1 with only the conference card changed: "Fall conferences is published. You can set up another now and publish it after it ends."
  - Never suggest unpublishing.
- **Decision needed:** should finished conferences stop counting toward the limit?

### 2. Hidden jobs need the database work, and the plan rules in the design don't match the database · 2 of 6
- **Hidden jobs:** the "ready" setting doesn't exist yet. Public and staff read rules, sign-up, and the item board all need it (medium build, with security tests).
- **Free accounts and drafts:** the database refuses even a *draft* of an event type outside the account's package. So "you can still set up any kind of event" is false for Free accounts, including teacher accounts. *Confirmed in code (the events_type_in_package trigger).*
- **The plan reason varies:** depending on the package, an unused pass, and whether the plan lapsed, the real answer to "can I publish?" changes. The badges must come from the database's own answer, not fixed wording. The design also needs a "you have a pass" state and a "your package doesn't include Coordinators" state.
- **Decision needed:** may accounts without a plan create drafts of every event type?

### 3. Who can preview a hidden job is described three different ways, with the wrong role names · 5 of 6
- **Role names:** the app calls the event-wide role a **Volunteer Lead** and the person running one job a **Coordinator**. "Volunteer Director" is only the name the database uses. Co-hosts are missing from every sentence.
- **Fix:** use one accurate sentence everywhere: "Hosts, Co-hosts, Volunteer Leads, and this job's Coordinator can preview it." Before an invited Coordinator accepts: "Maria can preview it after she accepts the invite."

### 4. Unpublish is a plain link, but it can't be undone · 5 of 6
- **Fix:** put the publishing controls in their own bar (as DESIGN.md says). Unpublish gets a red outline and a confirmation that names the people signed up and says it can't be republished. Offer "Close sign-up" as the safer choice.
- **Also:** reminders and the daily summary must skip unpublished events.

### 5. "Move or remove the people signed up" leads nowhere · 3 of 6
- **Fix:** make "2 signed up" a link to that shift's list, with "Move to another shift" and "Remove" for each person.

### 6. The job page has three kinds of saving, and work can be lost · 4 of 6
- **What happens:** "Add this shift", "Save, keep hidden", and "Continue to publish" (the loudest button) all appear while a shift is half typed.
- **Fix:**
  - Show "All changes saved" or "Unsaved changes".
  - Quiet "Continue to publish" while there are unsaved edits.
  - Ask before leaving.
  - Use the same button order at every width.

### 7. The plan limit disappears for the whole setup · 2 of 6
- **Fix:** show "Publish · 🔒 Needs a plan" in the step bar from the first setup screen.
- **Also:** the "ready to publish" and "plan doesn't allow" screens are two different account states, so label them that way.

### 8. "Ready" means three things · 4 of 6
- **What happens:** the save bar on the things-to-bring job says "Ready to show volunteers" with a green dot while the job is hidden.
- **Fix:** use only two words: **Ready** (volunteers can see it) and **Hidden**.

### 9. The dashed outline means four different things · 1 of 6
- **What happens:** the preview says "hidden jobs have a dashed outline", but dashed also marks buttons you can't press yet, optional shortcuts, and later steps.
- **Fix:** keep dashed for hidden jobs only. Buttons you can't press get a solid border, a muted fill, and a reason.

### 10. Details are saved only on this device · 4 of 6
- **What happens:** the database needs date, times, and address before an event can exist, so a half-done event can't follow the PTO president from her phone to her laptop. On a shared front-office computer, the next person sees it.
- **Decision needed:** save a draft to the account as soon as it has a name (medium build), or keep it in the browser and say so honestly (small).

### 11. Multi-day events: shifts have no day picker · 1 of 6
- **Fix:** when the event spans days, show a day picker and show the day on every shift.

### 12. Missing states · 2 of 6
- **Missing:**
  - a failed save
  - spots set below the minimum (show the error, not just the hint)
  - after the event
  - changing a shift's time when people are signed up
  - what "Later" leads to
  - a Volunteer Lead (who can't publish) reaching the Publish step
  - a live page with nothing left to sign up for
  - deleting a whole job
  - picking which past event to copy

### 13. Small row actions on phones · 3 of 6
- **What happens:** Edit and Delete are about 20 px text links side by side, the chip's × is about 16 px, and the step links are small.
- **Fix:** make each one a 44 px target, with Delete moved into the edit panel.

## Should fix (severity 2)

- **"We don't email anyone" is untrue:** daily summaries and reminders exist. Say "We don't send the link for you".
- **Too many names for one state:** "Live", "published", "online", and "open". Use "Published" plus "Sign-up open" or "Sign-up closed".
- **Screen 11 says "Next: add a volunteer job" to someone who has 2:** say "Next: mark a job ready", and list what each job is missing.
- **The sign-up-closed screen drops most of the live page:** keep the live layout and word it by history ("hasn't opened yet" or "you closed it on…").
- **Editing a live job doesn't say it's live:** add "Changes show to volunteers as soon as you save", restore the save bar, and keep Coordinator and check-in fields.
- **Phone job switcher:** it hides every other job's status. Use a short stacked list.
- **Badges look like buttons:** use an 8 px radius, a soft fill, and no dark outline, with 2–4 words.
- **Dark mode controls:** unchecked boxes and radios look filled, and hint text is grey (DESIGN.md says no grey text in dark mode).
- **Error screen drops the heading, step bar, and other fields:** keep the whole form and mark only the problems.
- **Sample numbers still disagree:** Host and Coordinator previews show different shift counts, and the totals don't add up.
- **Duplicate "Event settings":** remove it. The daily-email row needs a "Change" link.
- **Volunteer Leads can't publish, but nothing says so:** show "A Host publishes this event: ask …".
- **The delete-with-sign-ups check is app-only, and timing can beat it:** enforce it in the database, with row locks.
- **Hide or delete edge cases:** the last shift of a ready job, and the last ready job of a live event.
- **Two people editing one job:** show "Last saved by …".
- **"Copy jobs and shifts" is a full feature:** a past-event picker, moving dates, resetting item counts, and not copying Coordinators. Keep it as its own work item.

## Polish (severity 1)

- **Lock icon:** use one line-icon lock (no emoji).
- **Link alignment:** line up link edges.
- **Sample name:** "Hana Host" reads like a role.
- **Fonts:** re-shoot with Inter loaded, and set h1 to weight 500 before the build review.
- **Repeated hints:** remove repeated hints ("Pick a time" under "Starts").
- **The ✓ before a negative statement:** replace it.

## Notes for whoever builds it

- **Preview a separate server read:** it must never be a public page with a switch.
- **Already exists:** the spot minimum, sign-up open/closed, reschedule moving shifts, daily summary and reminder emails, and items to bring.
- **New:** the "ready" setting and its privacy rules, database-enforced delete and hide checks, plan-aware badges from the database, the multi-day shift day picker, and copy from a past event.

## Coverage

All six reviewers met the new minimum. The UI Designer and the consultant opened all 90.
