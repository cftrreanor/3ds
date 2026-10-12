---
name: heuristic-evaluation
description: Run a usability heuristic evaluation (Nielsen Norman Group method, Jakob Nielsen's 10 usability heuristics) on a whole product, one area, one flow or one screen, and write a workbook-style report of what is working well, the issues, severity ratings and recommendations. Use when the user asks for a heuristic evaluation, heuristic analysis, usability review or UX audit, or asks "what's confusing about X" or "how usable is this page/flow".
---

# Heuristic evaluation

This follows NN/g's method: **prepare → evaluate independently (two passes) → consolidate →
rate severity → report.** Findings are recorded against the 10 heuristics in the NN/g Heuristic
Evaluation Workbook. Each heuristic records what is **working well** as well as **issues** and
**recommendations**.

The skill works for any project. Nothing in it is specific to one product. Read the project's own
context in step 1.

Reference files in this folder:
- `heuristics.md`: the 10 heuristics, the workbook's guiding questions, and what to look for in a
  running app and in source code.
- `report-template.md`: the report layout. Fill it in exactly.

## 1. Prepare

**Set the scope.** NN/g advises keeping it narrow: one task, one section, or one device type.
If the user's request is broad ("the whole app"), split it into flows and propose an order. If
the scope, the main users or the task is unclear, ask **one** short question with
AskUserQuestion. Otherwise state your assumptions and go.

Record these for the report header (they mirror the workbook):
- **Product**: from the project's brand/config file or README. Don't hard-code it.
- **Task / scope**: e.g. "A volunteer signs up for a shift on a phone".
- **Users**: who does this task, their tech comfort, their device, and their context (e.g. on a
  phone, outdoors, rushed, on event day).
- **Evaluator(s)**, **Date**.

**Learn the project's context** before judging it: README, CLAUDE.md/AGENTS.md, any design system
doc (e.g. `docs/DESIGN.md`), product docs, and the routes/components in scope. House rules in those
files are the project's "standards" for heuristic 4 (Consistency and standards).

**Decide how you will see the interface.** Use the best option available:
1. **Run it and look at it** (preferred). Use the `run` skill or the project's dev command, then
   drive it with Playwright (Chromium is preinstalled in cloud sessions; never run
   `playwright install`). Take screenshots at **phone width (390px)** and desktop width. Save them
   next to the report. Use the project's demo/sample data or demo mode if it has one. Never use
   real people's data or real credentials.
2. **Read the code** if it can't run (e.g. missing database keys). Read the pages, components,
   form validation, error messages, empty states and loading states. Say clearly in the report that
   the evaluation was done from code, without seeing rendered screens, and lower your confidence on
   visual findings.

## 2. Evaluate independently

NN/g recommends **3–5 evaluators** working independently, because one evaluator finds only a
fraction of the problems. Simulate this with **three evaluator perspectives** chosen to fit the
scope's users. For example:
- a **first-time, low-tech user** on a phone (e.g. a parent volunteer),
- a **frequent expert user** under time pressure (e.g. the event host on event day),
- an **accessibility-minded reviewer** (keyboard, screen reader, contrast, small screens, glare).

If the Agent tool is available and the user has invoked this skill, run the three perspectives as
**parallel subagents**. Give each one the scope, users, how to view the app, and `heuristics.md`.
Don't let them see each other's findings, which keeps the passes independent the way NN/g
requires. Otherwise, do the three perspectives one after another and don't revise an earlier pass
after starting the next.

Each evaluator makes **two passes**:
1. **Flow pass**: go through the task end to end to get a feel for the flow. Note where you
   hesitated, got lost, or had to guess.
2. **Detail pass**: go screen by screen, element by element. For each one, check it against all 10
   heuristics using the guiding questions in `heuristics.md`.

For every finding, record:
- **Where**: screen/route and element, plus the file path and line (`src/app/...:42`) when known.
- **Heuristic(s)** violated. One finding can break more than one.
- **What happens** and **why it matters to this user**, described concretely. Don't write "the
  UX is unclear".
- **Evidence**: a screenshot name or a code reference.
- **Recommendation**: a specific fix the team could build.

Also record what is **working well** under each heuristic. The workbook calls for it, it protects
good patterns from being "fixed" away, and it gives the reader a balanced picture.

A heuristic violation is not automatically a problem. NN/g warns that context matters. If a design
breaks a heuristic for a good reason (e.g. the privacy rule that hides phone numbers until event
day), note it as a **deliberate trade-off**, not an issue.

## 3. Consolidate

Merge the three evaluators' lists:
- Cluster duplicates into one issue and note **how many evaluators found it** (1/3, 2/3, 3/3).
- Keep findings only one evaluator raised. Single-evaluator finds are exactly why NN/g uses
  several evaluators.
- Where perspectives disagree, say so briefly and give your judgement.

## 4. Rate severity

After consolidating, each perspective rates **every** issue on NN/g's 0–4 scale, independently.
Rate on **frequency** (how many users hit it), **impact** (how hard it is to overcome) and
**persistence** (does it keep happening once a user has learned it):

| Rating | Meaning |
|---|---|
| 0 | Not a usability problem |
| 1 | Cosmetic: fix only if there's spare time |
| 2 | Minor: low priority |
| 3 | Major: important to fix, high priority |
| 4 | Usability catastrophe: must fix before release |

Report the **average** (one decimal place). Drop issues that average below 0.5, or move them to
"Considered and set aside".

## 5. Report

Write the report with `report-template.md` to
`docs/heuristic-evaluations/YYYY-MM-DD-<short-scope-slug>.md` (create the folder if needed). Put
screenshots in a matching folder `docs/heuristic-evaluations/YYYY-MM-DD-<slug>/`.

Writing rules:
- Write for a **non-technical reader** (product owner, client, director). Use plain words. Explain
  any unavoidable term the first time you use it. Keep file paths in a "Where" line, never in the
  main sentence.
- The **Top priorities** list leads the report: the 3–7 most severe issues, each with a one-line
  fix.
- Cover all 10 heuristics in order. If nothing applies to one, say "No issues found" and still list
  what is working well.
- Be honest about limits. This is an expert review by an AI, not testing with real users. It finds
  likely problems cheaply but can miss problems and misjudge severity. Recommend a short test with
  3–5 real users for the top issues.

In chat, give a short summary: the top 3 issues, counts by severity, and where the report is. Then
offer next steps: fix the top issues, publish the report as a shareable page, or evaluate the next
flow. **Don't change product code during an evaluation.** Fixing is a separate request.
