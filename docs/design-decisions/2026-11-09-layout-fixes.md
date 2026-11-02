# Setup checklist layout fixes (2026-11-09)

Deferred earlier ("Sticky bar covers content; sidebar clipped with no cue", band contest mock-ups;
"Phone sticky setup bar covers buttons", band PR 1). Applies to every event type's event page.

Light check: UX Designer, UI Designer, consultant (flow and accessibility). Screens in
docs/design-reviews/2026-11-09-layout-fixes/.

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| — | (Before review) Footer's "Send feedback" sat under the phone bar; keyboard focus could land behind it | 2 | Fixed | Room under the whole page while the bar shows; focus stops above it |
| — | (Before review) Panel ran off the bottom of the screen with no cue | 2 | Fixed | Fits the visible screen; fade and "More below" while there's more |
| 1 | Fade could cover the step that has keyboard focus (3 of 3) | 2 | Take the advice | Focus stops above the fade (tested: 0 px hidden) |
| 2 | Panel heading and progress scrolled away (3 of 3) | 2 | Take the advice | Pinned; only the steps scroll, with a fade at the top while there's more above |
| 3 | Panel too narrow; descriptions wrap to 4–5 lines | 2 | Owner: descriptions on the Next step only | Width unchanged; the phone drawer keeps every description |
| — | "More below" a small, faint, unreachable button | 1 | Take the advice | A plain cue; the list itself scrolls by wheel and keyboard (focusable "Setup steps" region) |
| — | Phone bar see-through, faint top edge | 1 | Take the advice | Solid, with a top line and light shadow |
| — | Tablet bar's arrow far from its label | 1 | Take the advice | Bar content kept to the page width |
| — | Tablet ends without the "Send feedback" line | 1 | Keep as is | The side Feedback tab is the tablet and computer entry point |
| — | Check focus stopping above the bar in iPad Safari | 1 | Later | Check on a real iPad with a keyboard |
