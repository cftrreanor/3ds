---
version: alpha
name: Field Command Events
description: "A bold, field-ready command center that pairs confident game-day color with calm, readable layouts, helping schools, teams, and event crews coordinate every moving part."
colors:
  primary: "#1749D8"
  primary-hover: "#123BAF"
  on-primary: "#FFFFFF"
  background: "#F6F8FC"
  surface: "#FFFFFF"
  border: "#D9E0EA"
  text: "#172033"
  text-muted: "#5B667A"
  accent: "#C94716"
  success: "#16794A"
  warning: "#854600"
  danger: "#B42318"

typography:
  display:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.03em
  heading:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.02em
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: -0.01em
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6

spacing:
  base: 8px
  scale: [4, 8, 12, 16, 24, 32, 48, 64, 96, 128]

radius:
  sm: 6px
  md: 10px
  lg: 16px
  xl: 24px
  pill: 9999px

shadows:
  card: "0 2px 8px rgba(23, 32, 51, 0.06), 0 1px 2px rgba(23, 32, 51, 0.04)"
  elevated: "0 12px 32px rgba(23, 32, 51, 0.14), 0 4px 10px rgba(23, 32, 51, 0.08)"
  focus: "0 0 0 3px rgba(23, 73, 216, 0.28)"

motion:
  duration-fast: 120ms
  duration-base: 200ms
  duration-slow: 320ms
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
---

# Field Command Events design system

The tokens above are implemented in `src/app/globals.css` (colors, dark theme,
fonts, radius, shadows, focus ring, reduced motion), the fonts in
`src/app/layout.tsx`, and the shared components in `src/components/ui.tsx`.

## How the colors are used in the code

| Token (Tailwind class) | Role |
|---|---|
| `brand` (`bg-brand`, `text-brand`) | Primary: main actions, links, selected controls, progress. Hover `brand-hover`. |
| `brand-soft` | Info panels, the selected row or current item, the "schedule updated" banner. |
| `accent` / `accent-soft` | Orange, sparingly: the "Join the pilot" call to action, finalists, event identity. Never routine status. |
| `success` / `success-soft` | Done, confirmed, saved ("You're registered!"). |
| `warning` / `warning-soft` | Needs attention: due soon, unsaved schedule changes, demo mode. |
| `danger` | Late, blocked, failed, destructive. Always with text. |
| `muted`, `border`, `surface`, `raised`, `background`, `foreground` | Neutrals. |

Status colors always come with a text label; never rely on color alone.

## Type

- **Page titles (`h1`)**: Barlow Condensed, bold. Event names are the largest.
- **Section headings (`h2`, `h3`)**: Barlow.
- **Everything else**: Inter, 15px, with tabular numbers so times and counts line up.
- **Codes and IDs**: JetBrains Mono (`font-mono`).

## Rationale

Field Command Events serves people coordinating real-world events under time pressure: school staff, booster volunteers, coaches, choir directors, and event planners. The visual system should feel energetic and capable without making a busy schedule harder to scan. A saturated royal blue provides a confident command-center anchor, while a restrained orange accent brings the spirit of a sideline, stage, or rally without turning the entire interface into a poster.

The light palette uses a cool, near-white canvas and white surfaces to separate schedules, assignments, and updates into clear working areas. Deep ink text and muted but legible secondary text preserve readability in sunlight, on phones, and during quick handoffs. Status colors are reserved for meaningful signals—completed, at risk, or blocked—so teams can spot exceptions without mistaking decoration for urgency. A carefully tuned dark theme supports evening events and personal preference.

## Dark theme

Background `#0D1422`, surface `#151F30`, raised `#1C293D`, border `#2C3A50`, text `#F2F5FA`, muted `#A8B4C7`, primary `#89A4FF` (hover `#A1B5FF`, on-primary `#10192B`), accent `#FF9872`, success `#64D69A`, warning `#FFC266`, danger `#FF8A80`. Large status areas use a low-opacity tint with a brighter foreground.

## Accessibility

- Touch targets at least 44×44px (buttons and inputs are `min-h-11`).
- Focus: 2px `primary` outline with a 2px offset (`#A1B5FF` in dark mode); inputs show a 3px focus ring.
- Respects `prefers-reduced-motion`.
- Normal text meets WCAG AA or better against its background.
