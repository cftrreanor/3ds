# Meals for visiting bands (2026-11-06)

Owner request: a "will you provide meals for visiting bands?" question in registration setup, with the
price of one meal (shown to directors before their meal field), details and options (vegetarian, halal,
gluten free), and an optional field for directors to say how many meals they need.

Light check: Content Manager, UX Designer. Screens in docs/design-reviews/2026-11-06-band-meals/.

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | Free-text meal requests can't be totaled; the host adds by hand | 3 | Owner: a number per option | Host lists options as chips (Regular, Vegetarian, Halal, Gluten free); directors enter a number for each; the band list shows totals by option and the cost; the download has a column per option |
| — | Director never sees what they owe | 2 | Take the advice | Live "116 meals × $8.50 = $986" on the form; the band page shows the order and total |
| — | When meal counts lock | 2 | Owner: same as the registration deadline | Directors edit their registration (meals included) while it's open |
| — | "The host provides meals for visiting bands" | 2 | Take the advice | "Meals are $8.50 each, from the organizer" |
| — | Help text on price, details, and the tick box | 1 | Take the advice | Says where directors see it and where answers show up |
| — | "Meals" looks like a field label; fields don't look grouped | 1 | Take the advice | Price, options, and details indented under the tick box |
| — | Warn before unticking when bands have ordered | 2 | Later | Orders are kept; unticking only hides the question |
