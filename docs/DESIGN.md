---
version: beta
name: Field Command Events (restrained blue)
description: "A calm, dependable look: white pages with warm off-white panels, near-black text, one deep blue for actions, selection and the header, and the darkest navy for the closing band. Soft corners and very soft shadows. Adapted from a DESIGN.md the owner supplied (an interpretation of a scheduling brand); its proprietary faces are replaced by Inter."
colors:
  primary: "#0B3558"        # deep blue: buttons, links, selection, header (white on it 12.6:1)
  primary-deep: "#071A31"   # hover, and the closing band
  on-primary: "#FFFFFF"
  sky-soft: "#B9D3F0"       # the hero's pill button (deep blue on it 8.2:1)
  accent: "#1A5C8F"         # sparingly: finalists, the pilot pill (white on it 7.1:1)
  canvas: "#FFFFFF"
  surface: "#FCFBF8"        # warm off-white panels and cards
  hairline: "#DFE3E8"
  field-border: "#5F6D77"   # text-box, option and panel edges (5.3:1 on white); dark mode #5F7489
  ink: "#0A0A0A"            # 19.8:1 on white
  ink-mute: "#4B5F72"       # slate blue, 6.6:1 on white, 6.4:1 on surface
  on-dark-mute: "#B5C3D1"   # 7.0:1 on primary
  success: "#16794A"
  warning: "#854600"
  danger: "#B42318"

typography:
  display:
    fontFamily: "Inter (variable), system-ui, sans-serif"
    fontSize: 48-64px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -0.04em
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
  sm: 8px    # small controls, tags
  md: 12px   # buttons and inputs (pills only in the home page hero and header)
  lg: 20px   # cards and panels
  xl: 24px   # dialogs
  full: 9999px

shadows:
  card: "0 4px 5px rgba(95,109,119,.04), 0 8px 15px rgba(95,109,119,.03), 0 15px 30px rgba(95,109,119,.06)"
  elevated: "0 4px 5px rgba(95,109,119,.04), 0 8px 15px rgba(95,109,119,.03), 0 30px 50px rgba(95,109,119,.08)"

motion:
  duration: 150ms
  easing: "cubic-bezier(0.4, 0, 0.2, 1)"
---

# Field Command Events design system

The tokens above are implemented in `src/app/globals.css` (colors, dark theme,
font weights, radius, shadows, focus ring, reduced motion), the fonts in
`src/app/layout.tsx`, and the shared components in `src/components/ui.tsx`.

## How the colors are used in the code

| Token (Tailwind class) | Role |
|---|---|
| `brand` (`bg-brand`, `text-brand`) | Deep blue: main actions, links (always underlined), selected controls. Hover `brand-hover` (darkest navy). |
| `brand-soft` | A whisper of blue: info panels, the selected row or current item, the "schedule updated" banner. |
| `violet` | Pale sky blue (the token keeps its old name): the pill button in the home page hero and the header's "Request a pilot spot". Nowhere else. |
| `accent` / `accent-soft` | A brighter blue, sparingly: finalists, the pilot pill. Never routine status. |
| `teal-deep` | Darkest navy (the token keeps its old name): the closing band at the bottom of marketing pages. |
| `success` / `success-soft` | Done, confirmed, saved. |
| `warning` / `warning-soft` | Needs attention: due soon, unsaved changes, demo mode. |
| `danger` | Late, blocked, failed, destructive. Always with text. |
| `muted`, `border`, `field-border`, `surface`, `raised`, `background`, `foreground` | Neutrals: white canvas, warm off-white panels, near-black ink, slate-blue supporting text, slate edges on fields. |
| `header` | The header bar and the phone outlines around screenshots: deep blue, always dark so the white logo reads. |

Status colors always come with a text label; never rely on color alone. No
other accent colors.

## Type

- **One face**: Inter, loaded as a variable font so the in-between weights render: 460 for body (`font-normal`), 540 for headings and emphasis (`font-medium`), 600 for buttons and labels (`font-semibold`), 700 only for emphasized inline text (`font-bold`).
- **Page titles (`h1`)**: weight 500, 1.1 leading, tight tracking (-0.04em). Don't go heavier.
- **Tabular numbers** everywhere so times and counts line up. Codes and IDs use JetBrains Mono (`font-mono`).

## Home page

Three canvases: a deep-blue hero with a soft sky glow (`.hero-sky`) and one
pale-blue pill CTA; white and off-white body sections; and a darkest-navy
closing band with one white button. One call to action per band. Screenshots
sit in a deep-blue phone outline (`PhoneFrame`) and use made-up sample data.

## Admin (back office)

The admin dashboard (`/admin`) is a desk tool for FieldCommand staff, styled like a CRM rather
than the customer app: a deep-blue sidebar, a search bar, then dense sortable tables and record
pages (a main column with a timeline, a 20rem side column of panels). Its pieces live in
`src/app/admin/kit.tsx`: small headers, flat panels with uppercase labels, tables with
sticky headers, square-cornered tags, and health dots (green healthy, blue new, amber watch,
red at risk, always with a word). Controls are 32px tall there, since it's used at a desk; the
customer app keeps its 44px touch targets. Same tokens, fonts and dark theme.

## Dark theme

Background `#06121F`, surface `#0C1F33`, raised `#132A42`, border `#253A51`,
text `#F2F5F8`, muted `#A9B8C7`, primary `#9CC3EE` (on-primary `#071A31`),
accent `#7FB6E0`, success `#64D69A`, warning `#FFC266`, danger `#FF8A80`.
Header and closing band `#071A31`.

## Accessibility

- Touch targets at least 44×44px (buttons and inputs are `min-h-11`).
- Focus: 2px `primary` outline with a 2px offset (light blue in dark mode); inputs show a 3px focus ring.
- Respects `prefers-reduced-motion`.
- Normal text meets WCAG AA or better against its background.
