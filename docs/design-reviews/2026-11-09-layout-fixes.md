# Design review: setup checklist layout fixes (light check)

**Date:** 2026-11-09 · **Size:** light check (layout, same steps) · **Reviewers:** UX Designer, UI
Designer, usability consultant · **Screenshots:** `docs/design-reviews/2026-11-09-layout-fixes/` (phone,
tablet, desktop; light and dark; screen-sized)

This is an AI review, not testing with real people. Nothing was rated 3 or 4.

## Severity 2
- **The fade could cover the step you tabbed to** (3 of 3). Fixed: focus stops above it.
- **The panel's heading and progress scrolled away** (3 of 3). Fixed: pinned.
- **The panel is narrow; descriptions wrap to 4–5 lines** (UI Designer). Owner: descriptions on the
  Next step only.

## Severity 1
"More below" was a small, faint button that keyboards and voice control couldn't reach (now a plain
cue; the list scrolls by wheel and keyboard); the phone bar was see-through; the tablet bar's arrow sat
far from its label; tablet has no footer feedback line (kept: the side tab covers it); check iPad Safari
by hand.

## What's working well
- The end of the page, the footer included, now clears the phone and tablet bar
- The panel always ends within the screen, and the cue disappears at the end of the list
- The bar's "1 of 3 needed to publish" and "Next:" give the next step at a glance
- Dark mode holds up; no sideways scrolling at 390 px

Decisions: `docs/design-decisions/2026-11-09-layout-fixes.md`.
