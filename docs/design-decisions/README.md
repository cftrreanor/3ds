# Design decisions

Every design review finding rated 2 or higher gets a decision from the owner, logged here so we
can see later why something is the way it is.

One file per review, named like the review: `YYYY-MM-DD-<slug>.md`. The review report itself
lives in `docs/design-reviews/`.

## Format

```markdown
# Decisions: <scope> (YYYY-MM-DD)

Review: docs/design-reviews/YYYY-MM-DD-<slug>.md

| # | Finding | Severity | Decision | Notes |
|---|---|---|---|---|
| 1 | <short name> | 3 | Take the advice | <PR or commit when done> |
| 2 | <short name> | 2 | Fix it differently | <what we're doing instead> |
| 3 | <short name> | 2 | Keep as is | <the reason> |
```

The three decisions:
- **Take the advice:** do the suggested fix.
- **Fix it differently:** the owner and Claude agree on another fix, written in the notes.
- **Keep as is:** the reason is written in the notes. A future reviewer who raises the same
  thing should be pointed here.

Findings rated 3 or 4 can't be built or shipped until they have a decision. Only the owner
decides. Claude suggests, but never fills in a decision on the owner's behalf.
