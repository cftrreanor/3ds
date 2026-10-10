---
version: beta
name: Field Command Events (editorial)
description: "A calm, editorial look: deep indigo navy for the brand and main actions, warm white pages with off-warm-grey ink, and deep teal as the single colour interlude. One variable sans at in-between weights. Adapted from a DESIGN.md the owner supplied (an interpretation of an editorial productivity brand); the proprietary face is replaced by Inter."
colors:
  primary: "#1B1938"
  primary-deep: "#0E0C1F"
  on-primary: "#FFFFFF"
  violet-soft: "#C9B4FA"
  teal-deep: "#0E3030"
  teal-mid: "#155555"
  canvas: "#FFFFFF"
  canvas-soft: "#FAFAF8"
  hairline: "#E8E4DD"
  hairline-dark: "#3F3A52"
  ink: "#292827"
  ink-mute: "#73706D"
  on-dark-mute: "#BCBAC9"
  success: "#16794A"
  warning: "#854600"
  danger: "#B42318"

typography:
  display:
    fontFamily: "Inter (variable), system-ui, sans-serif"
    fontSize: 48-64px
    fontWeight: 460-540
    lineHeight: 0.96-1.02
    letterSpacing: -0.025em
  heading:
    fontFamily: "Inter (variable)"
    fontSize: 20-28px
    fontWeight: 540
    lineHeight: 1.15
    letterSpacing: -0.015em
  body:
    fontFamily: "Inter (variable)"
    fontSize: 16px
    fontWeight: 460
    lineHeight: 1.5
  button:
    fontFamily: "Inter (variable)"
    fontSize: 14px
    fontWeight: 600
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"

spacing:
  base: 8px
  scale: [2, 4, 8, 12, 16, 24, 32, 64]

radius:
  sm: 6px   # inputs
  md: 8px   # buttons (rounded rectangle; pills only in the home page hero)
  lg: 12px  # cards
  xl: 16px  # dialogs
  full: 9999px

shadows:
  card: "0 1px 3px rgba(0, 0, 0, 0.08)"
  elevated: "0 8px 24px rgba(0, 0, 0, 0.12)"
---

# Field Command Events design system

The tokens above are implemented in `src/app/globals.css` (colors, dark theme,
font weights, radius, shadows, focus ring, reduced motion), the fonts in
`src/app/layout.tsx`, and the shared components in `src/components/ui.tsx`.

## How the colors are used in the code

| Token (Tailwind class) | Role |
|---|---|
| `brand` (`bg-brand`, `text-brand`) | Indigo navy: main actions, links (always underlined), selected controls, the header bar. Hover `brand-hover`. |
| `brand-soft` | A whisper of violet: info panels, the selected row or current item, the "schedule updated" banner. |
| `violet` | Pale violet: the pill button on the home page hero (and the header's "Join the pilot"). Nowhere else. |
| `accent` / `accent-soft` | Teal, sparingly: finalists, event identity. Never routine status. |
| `teal-deep` | The closing band at the bottom of the home page. |
| `success` / `success-soft` | Done, confirmed, saved. |
| `warning` / `warning-soft` | Needs attention: due soon, unsaved changes, demo mode. |
| `danger` | Late, blocked, failed, destructive. Always with text. |
| `muted`, `border`, `surface`, `raised`, `background`, `foreground` | Neutrals: warm white canvas, white cards, off-warm-grey ink (never pure black). |

Status colors always come with a text label; never rely on color alone. No
other accent colors.

## Type

- **One face**: Inter, loaded as a variable font so the in-between weights render: 460 for body (`font-normal`), 540 for headings and emphasis (`font-medium`), 600 for buttons and labels (`font-semibold`), 700 only for emphasized inline text (`font-bold`).
- **Page titles (`h1`)**: `font-medium` (540), tight leading, slight negative tracking. Don't go heavier.
- **Tabular numbers** everywhere so times and counts line up. Codes and IDs use JetBrains Mono (`font-mono`).

## Home page

Three canvases: an indigo hero with a soft violet-and-sky glow (`.hero-sky`)
and one pill CTA; white body sections; and a deep-teal closing band with one
white button. One call to action per band.

## Admin (back office)

The admin dashboard (`/admin`) is a desk tool for FieldCommand staff, styled like a CRM rather
than the customer app: an indigo sidebar, a search bar, then dense sortable tables and record
pages (a main column with a timeline, a 20rem side column of panels). Its pieces live in
`src/app/admin/kit.tsx`: small headers, flat panels with uppercase labels, tables with
sticky headers, square-cornered tags, and health dots (green healthy, indigo new, amber watch,
red at risk, always with a word). Controls are 32px tall there, since it's used at a desk; the
customer app keeps its 44px touch targets. Same tokens, fonts and dark theme.

## Dark theme

Background `#0E0C1F`, surface `#17152F`, raised `#211E3D`, border `#3F3A52`,
text `#F4F2EE`, muted `#BCBAC9`, primary `#C9B4FA` (on-primary `#1B1938`),
accent `#7CC4C0`, success `#64D69A`, warning `#FFC266`, danger `#FF8A80`.

## Accessibility

- Touch targets at least 44×44px (buttons and inputs are `min-h-11`).
- Focus: 2px `primary` outline with a 2px offset (violet in dark mode); inputs show a 3px focus ring.
- Respects `prefers-reduced-motion`.
- Normal text meets WCAG AA or better against its background.
