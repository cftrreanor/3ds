# Standards

## Accessibility (WCAG 2.2 AA)

Check in **light and dark**, at **phone, tablet, and desktop** widths.

| Check | Pass when | WCAG |
|---|---|---|
| Text contrast | 4.5:1 for normal text, 3:1 for large text (24 px, or 19 px bold) | 1.4.3 |
| Contrast of controls and icons | Borders, focus rings, icons, and chart marks reach 3:1 against what's next to them | 1.4.11 |
| Color alone | Status never relies on color alone, and also has a word or icon | 1.4.1 |
| Tap targets | At least 24 × 24 px (WCAG minimum). We aim for 44 × 44 px on anything used on a phone. | 2.5.8 |
| Keyboard | Everything works with Tab, Enter, Space, and Esc, in a sensible order, with a visible focus ring | 2.1.1, 2.4.3, 2.4.7 |
| Focus not hidden | Sticky bars and pop-ups never cover the focused item | 2.4.11 |
| Labels | Every field has a visible label that its screen-reader name matches | 1.3.1, 2.5.3, 3.3.2 |
| Errors | Errors say what's wrong and how to fix it, next to the field, and are announced | 3.3.1, 3.3.3, 4.1.3 |
| Status messages | "Saved", "Sent", and "Offline" are announced without moving focus | 4.1.3 |
| Zoom and reflow | Works at 200% zoom and at 320 px wide, with no sideways scrolling | 1.4.4, 1.4.10 |
| Headings and landmarks | One h1, headings in order, and main and nav landmarks | 1.3.1, 2.4.6 |
| Motion | Nothing flashes. Animation respects "reduce motion". | 2.3.1, 2.3.3 |
| Time limits | Nothing times out without warning and a way to extend | 2.2.1 |
| Redundant entry | Don't ask for the same thing twice in one flow | 3.3.7 |
| Accessible sign-in | No puzzle or memory test to sign in. Email links are fine. | 3.3.8 |
| Images | Meaningful images have alt text. Decorative ones are hidden. | 1.1.1 |

For built pages, run axe in Playwright where possible (the scratchpad has an `axe/` folder from
earlier runs) and include its results. A clean axe run is not proof of accessibility, so still
check by eye.

## Content clarity

Source: `docs/brand-voice.md` (house rules) plus plain-language practice.

- **Plain words:** a word a parent would use out loud. No database, developer, or internal
  feature words.
- **Answer first:** the most important thing in the first few words.
- **Short:** one idea per sentence, about 20 words at most. Cut every word that doesn't help.
- **Buttons say what happens:** a verb plus an object ("Publish event", "Save shifts"), never
  "Submit", "OK", or "Click here".
- **Errors help:** say what happened and what to do, without blame and without codes.
- **Empty states:** say what goes here and give the first action.
- **Same thing, same word:** one name per thing, everywhere.
- **Right moment:** help text appears where and when it's needed, not in a wall at the top.
- **House rules:** no exclamation points, the Oxford comma, no periods on incomplete headlines,
  buttons, bullets, or labels, "organizer" for the role, "sign-up" (noun) vs "sign up" (verb),
  and in-app permission names stay "Host", "Co-host", and "Account Host".
- **Claims:** follow the claims guardrails in `docs/brand-voice.md`.

## Flow (the 10 usability heuristics)

The full guiding questions are in `.claude/skills/heuristic-evaluation/heuristics.md`. In
short:

1. **Visibility of system status:** where am I, what's saved, and what's happening now?
2. **Match with the real world:** their words, and the order the real event runs in
3. **User control and freedom:** undo, cancel, back, and leave without losing work
4. **Consistency and standards:** the same thing looks and works the same everywhere
5. **Error prevention:** stop mistakes before they happen, and confirm before anything risky
6. **Recognition rather than recall:** show options and context, don't make people remember
7. **Flexibility and efficiency:** shortcuts for repeat users, and reuse last year's setup
8. **Aesthetic and minimalist design:** only what helps the job at this moment
9. **Help users recover from errors:** plain error messages with a way forward
10. **Help and documentation:** help in context, when it's needed

Plus two of our own:
- **Action over information:** each state's main action matches its "job to be done" and is the
  most prominent thing.
- **Interruption-proof:** someone who looks away (the front office) or leaves for hours (the PTO
  president, the teacher) can pick up exactly where they were.
