# Volunteer shifts: adults needed, overlap, and From/To (2026-11-05)

Feedback from an organizer who runs many volunteer events. Applies to every event type.

## Owner decisions
- **Adults needed:** a job's shifts hold spots for adults (18+). Under-18s can't take them. A 6-spot
  shift needing 2 adults takes at most 4 under-18s.
- **Overlap:** each shift after the first starts early (6:00–8:00, 7:45–10:00, 9:45–12:00), keeping
  the boundaries on the hour.
- **Jobs outside the event's hours:** "Several shifts" (was "Fill the day") gets From and To times,
  starting at the event's hours.

## Mock-up check (Content Manager, UX Designer, usability consultant)
Screens in docs/design-reviews/2026-11-05-volunteer-shifts/.

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Unsaved warning names "Add or Save" buttons that aren't there | 3 | Take the advice | "Finish with the button under it, like Create shifts, Add, or Save" |
| 2 | Adults needed on a live event: impossible numbers, Adults only conflict, existing sign-ups | 3 | Take the advice | Can't exceed the most spots on a shift; greyed out with Adults only; "People already signed up keep their spots"; shift rows say "needs 1 more adult" |
| 3 | Public page: a teen learns about held spots after picking | 3 | Take the advice | Every affected shift says "1 of these saved for adults (18+)" to everyone; an under-18 sees "Open spots are for adults (18+)" |
| — | Overlap makes later shifts longer than Shift length | 2 | Take the advice | Hint says so; preview shows each shift's length when it differs |
| — | Preview read across rows | 2 | Take the advice | One numbered column, with total spots and time zone |
| — | "Fill the day" doesn't fit a setup crew | 2 | Take the advice | "Several shifts" / "One shift"; help names setup and cleanup |
| — | Edge cases: same From and To, overnight, outside event hours | 2 | Take the advice | Error for the same time; "ends the next day"; "This starts 2 hours before the event" |
| — | The rule hidden once More options closes | 2 | Take the advice | Closed header shows "· 2 adults per shift"; Several shifts says "2 of them saved for adults" |
| — | Adults needed field placed in Several shifts too | 2 | Fix it differently | Kept on the job (one setting for all its shifts); Several shifts points to it |
| — | "2 / 4 filled" vs "2 of 4 filled" | 1 | Take the advice | "2 of 4 filled" |
| — | One combined "Who can take these shifts?" control | 2 | Keep as is | Adults only and Adults needed stay separate; the number greys out with Adults only |
| — | "Who's signed up" says no one while rows show 2 filled | 2 | No change | Sample data only |

## Owner follow-up (2026-11-05)
- From and To start at the event's full hours (they already did; the first screenshot showed a typed-in setup-crew example). Screenshots now show both: 1a the event's hours, 1b a setup crew.
- Overlap is a tick box, "Overlap shifts", and once ticked a dropdown "By how much" in 5-minute steps up to 30 minutes (15 to start).
