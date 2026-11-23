# Documentation index

About 80 documents live here. This page says which to read first and which are history. The archive holds finished plans and superseded scorecards (`docs/archive/`); they stay for the record, and nothing in the code depends on them.

## Start here

| Need | Read |
| --- | --- |
| What the project is, how to run it, the checks | `../README.md`, `../CLAUDE.md` |
| Back end: API, database, providers | `backend-plan.md`, `backend-data-model.md`, `../server/README.md`, `../db/README.md` |
| Running and operating it | `runbook.md`, `static-host-headers.md`, `security-performance-plan.md` |
| Where we are and what is open | `review-and-completeness-plan.md` (current review, grades, open items), `release-scorecard.md` |
| Design and look | `design-language.md`, `look-and-feel-recommendations.md` |
| Contributing | `../CONTRIBUTING.md`, `../CHANGELOG.md` |

## By area

- **Stanley (the chat helper).** `stanley-plan.md` (overview), `stanley-answers-plan.md`, `stanley-actions-and-proactive-plan.md`, `stanley-gap-analysis-and-plan.md`, `stanley-authoring.md` (how to teach him), `stanley-data-inventory.md`, `stanley-launch-checklist.md`, `stanley-reminders-requirements.md`.
- **MCP and external services.** `mcp-integration-plan.md` (the plan, live probe findings, progress), `princess_stanley_free_mcp_services_research.md` (the research it started from; read the plan's section 1 for where reality differed).
- **Chat between guests.** `chat-plan.md`, `chat-stanley-plan.md`, `chat-bundles-plan.md`, `chat-ashore-plan.md`, `chat-urgency-plan.md`, `chat-features-research.md`.
- **Journey and stages.** `stage-experience-plan.md`, `stage-welcome-plan.md`, `stage-menus-matrix.md` (generated), `customer-journey-priorities.md`, `next-steps-guidance-plan.md`, `returning-home-plan.md`.
- **Catalogue, ships and ports.** `catalogue-plan.md`, `catalogue-data-model.md`, `catalogue-2027-research.md`, `aboard-plan.md`, `explorer-harmony-plan.md`, `explorer-planning-plan.md`, `port-details.md`, `port-stats.md`, `port-tips.md`, `content-verification.md`.
- **Requirements and research.** `functional-requirements.md`, `leading-features-requirements.md`, the `onboard-*-requirements.md` and `princess_*` research files, `requirements-clauses.md` with its `.tsv` data.
- **Quality and scorecards.** `best-in-market-matrix.md`, `best-in-market-plan-2.md`, `pain-points-*.md`, `audit-trail.md`, `test-plan-*.md`.
- **Features.** `games-plan.md`, `stats-plan.md`, `small-delights.md`, `experience-extension-ideas.md`, `multi-device-plan.md`.
- **Raw research notes** (the `princess-*.md` files): source material for ship and port content; not requirements.

## Keeping it tidy

A plan is archived (`git mv` into `archive/`) when every phase is done and its open items are recorded in a current document. A file that a test or script reads (search `docs/` in `src/` and `scripts/`) must not move.
