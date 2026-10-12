# Jakob Nielsen's 10 usability heuristics

Each heuristic gives the definition and guiding questions from the NN/g Heuristic Evaluation
Workbook, followed by what to look for on screen and in the code.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/

---

## 1. Visibility of system status
The design should always keep users informed about what is going on, through appropriate feedback
within a reasonable amount of time.

**Workbook questions**
- Does the design clearly communicate its state?
- Is feedback presented quickly after user actions?

**Look for**
- On screen: Is it clear where I am (page title, active nav, step "2 of 4")? Does each button
  give feedback when pressed (pending state, disabled while saving, success message)? Are
  "saved", "sent", "published" and "draft" states visible? Is live or real-time data marked as
  live, and is stale data marked as stale? Are counts and capacity visible (e.g. "3 of 5 spots
  left")?
- In code: form submits with no pending UI (`useFormStatus`, `useActionState`, `isPending`); server
  actions that redirect without a confirmation message; missing `loading.tsx` or skeletons; silent
  `catch` blocks.

## 2. Match between system and the real world
The design should speak the users' language. Use words, phrases, and concepts familiar to the
user, rather than internal jargon. Follow real-world conventions, making information appear in a
natural and logical order.

**Workbook questions**
- Will the user be familiar with the terminology used in the design?
- Do the design's controls follow real-world conventions?

**Look for**
- On screen: database or developer words in the UI ("slot", "RLS", "null", "record", "submit
  entity", internal role names that users wouldn't say); dates, times and time zones shown the way
  the user thinks of them; lists ordered the way the real event runs (by time, by performance
  order); icons whose meaning isn't obvious.
- In code: user-facing strings copied from column or enum names; raw ISO dates; times without a
  time zone.

## 3. User control and freedom
Users often perform actions by mistake. They need a clearly marked "emergency exit" to leave the
unwanted action without having to go through an extended process.

**Workbook questions**
- Does the design allow users to go back a step in the process?
- Are exit links easily discoverable?
- Can users easily cancel an action?
- Is Undo and Redo supported?

**Look for**
- On screen: Cancel or Back on every multi-step form and dialog; a way to leave a shift, withdraw
  a registration or unsubscribe; whether the browser Back button works; whether there's a way out
  of a mode (e.g. demo mode, impersonation, edit mode).
- In code: actions with no reverse action; dialogs without a close or Escape handler; flows that
  lose typed input on navigation.

## 4. Consistency and standards
Users should not have to wonder whether different words, situations, or actions mean the same
thing. Follow platform and industry conventions.

**Workbook questions**
- Does the design follow industry conventions?
- Are visual treatments used consistently throughout the design?

**Look for**
- On screen: the same action named differently in different places ("Sign up", "Register",
  "Join"); primary and destructive buttons styled inconsistently; links that look like buttons or
  buttons that look like text; platform conventions (tap targets ≥ 44px on phones, logo goes home,
  underlined links).
- In code: deviations from the project's design system doc, shared components and house rules in
  CLAUDE.md (these define "standards" for this project); one-off colours or spacing instead of
  tokens.

## 5. Error prevention
Good error messages are important, but the best designs carefully prevent problems from occurring
in the first place. Either eliminate error-prone conditions, or check for them and present users
with a confirmation option before they commit to the action.

**Workbook questions**
- Does the design prevent slips by using helpful constraints?
- Does the design warn users before they perform risky actions?

**Look for**
- On screen: confirmation before deleting, cancelling, emailing everyone, publishing or charging;
  constrained inputs (date pickers, digits-only fields, choosing from a list instead of typing);
  sensible defaults; full slots disabled before the user tries them; double-submit protection.
- In code: destructive server actions with no confirm step; validation only on the server with no
  inline hints; missing `required`, `maxLength` or input modes; race conditions on limited
  capacity.

## 6. Recognition rather than recall
Minimize the user's memory load by making elements, actions, and options visible. The user should
not have to remember information from one part of the interface to another. Information required
to use the design (e.g. field labels or menu items) should be visible or easily retrievable when
needed.

**Workbook questions**
- Does the design keep important information visible, so that users do not have to memorize it?
- Does the design offer help in-context?

**Look for**
- On screen: placeholder-only labels that vanish on typing; having to remember a code, date or
  name from an earlier page; key details (time, place, what to bring) missing from the
  confirmation page or email; recently used and "my items" shortcuts.
- In code: inputs without a `<label>`; confirmation views that don't repeat what was chosen.

## 7. Flexibility and efficiency of use
Shortcuts, hidden from novice users, may speed up the interaction for the expert user such that
the design can cater to both inexperienced and experienced users. Allow users to tailor frequent
actions.

**Workbook questions**
- Does the design provide accelerators like keyboard shortcuts and touch gestures?
- Is content and functionality personalized or customized for individual users?

**Look for**
- On screen: bulk actions for hosts (copy last year's event, import a list, message everyone in a
  group); a role-aware home or dashboard; saved filters and search; links that open straight to the
  user's thing (e.g. "my shifts"); add-to-calendar.
- In code: features that require repeating the same form many times; no deep links.

## 8. Aesthetic and minimalist design
Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of
information in an interface competes with the relevant units of information and diminishes their
relative visibility.

**Workbook questions**
- Is the visual design and content focused on the essentials?
- Have all distracting, unnecessary elements been removed?

**Look for**
- On screen: Is the one main action obvious on each screen? Walls of text, rarely used options shown
  up front, competing banners, clutter at phone width, poor contrast or hierarchy.
- In code: many equal-weight buttons; long pages with no progressive disclosure.

## 9. Help users recognize, diagnose, and recover from errors
Error messages should be expressed in plain language (no error codes), precisely indicate the
problem, and constructively suggest a solution.

**Workbook questions**
- Does the design use traditional error message visuals, like bold, red text?
- Does the design offer a solution that solves the error immediately?

**Look for**
- On screen: Is the error shown next to the field it concerns? Does it say what to do next? Is the
  user's input kept after an error? What do the 404 and "not allowed" pages say, and do they offer a
  way forward? What happens offline or with a weak signal?
- In code: raw `error.message` from the database or library shown to users; generic "Something
  went wrong"; missing `error.tsx` and `not-found.tsx`; errors without `aria-live` or
  `role="alert"`.

## 10. Help and documentation
It's best if the system doesn't need any additional explanation. However, it may be necessary to
provide documentation to help users understand how to complete their tasks.

**Workbook questions**
- Is help documentation easy to search?
- Is help provided in context right at the moment when the user requires it?

**Look for**
- On screen: short hints beside tricky fields; "what happens next" text after signing up; a visible
  contact or support route; first-run guidance for hosts setting up an event; empty states that
  explain how to get started.
- In code: whether help text exists near complex forms; where the support email or contact link is
  surfaced (should come from the project's config, not be hard-coded).
