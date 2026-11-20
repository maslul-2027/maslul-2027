# Locked product decisions + meeting/task spec -> code -> tests (handoff `MASLUL_HANDOFF_BILINGUAL_2026-11-11 v4`)

Sources: `PRODUCT_DECISIONS_LOCKED.md`, `FEATURE_SPEC_MEETING_TASKS_HE_EN_v1.md` (the spec still says "not implemented"; the code below shows it IS implemented in the Apps Script source `src/`).
"Status" = implemented and tested in the Apps Script app at this branch (Node/Chromium, synthetic). **None of it is verified on Google TEST, and none of it is ported to a separate "new app" backend** — the current app is `src/` (same UI, UX sprint 1 on top).

| # | Decision / requirement | Code | Tests (names as printed by the suites) | Status |
|---|---|---|---|---|
| D1 | Fitness total = 20/20/20/10/30; total only when all five components exist; missing != 0 | `src/Scoring.gs`, `src/Fitness.gs` | `v103_fitness` 4 (88.0 example), 7+10 | implemented, tested |
| D2 | Separate men / women tables; table chosen by gender | `src/Scoring.gs` | `v103_fitness` 1, 2, 3, 11 | implemented, tested |
| D3 | Out of range => `out_of_range`, no auto score, no clamp/fallback; boundaries exact | `src/Scoring.gs` | `v103_fitness` 5, 6 | implemented, tested |
| D4 | 300 m naming, mm:ss format only, no invented behaviour | `src/Scoring.gs`, `src/Index.html` | `v103_fitness` 8, labels test | implemented, tested |
| O1 | Course = 2 departments x 2 teams; soldier assignment fixed | `src/Courses.gs`, `src/Soldiers.gs` | `d7_authz`, `soldiers`, org tests | implemented (see note 1) |
| O2 | Admin full; commander only assigned scope (assignments merge); no assignment = no access; enforced server-side | `src/Navigation.gs`, `src/Assignments.gs`, `src/AuthAudit.gs` | `d7_authz` (class-driven, all 174 routes), `pd6_meetings_tasks` scope tests | implemented, tested |
| O3 | No physical deletion; cancel/restore documented; cancelled hidden from commanders and excluded from calculations | `src/Soldiers.gs`, `src/Records.gs` | `v1_private` (follow-ups/favorites), `pd6_meetings_tasks` (cancel not delete) | implemented, tested |
| O4 | Commander's private assessments/notes: admin only, not in reports/AI by default | `src/Private.gs`, `src/Reports.gs`, `src/Assistant.gs` | `v1_private` 1 (every private route FORBIDDEN for commanders) | implemented, tested |
| O5 | Course clone copies structure/settings only | `src/Courses.gs` | clone tests in `integration` suite | implemented (see note 1) |
| O6 | OCR creates drafts only; per-row approval | `src/Ocr.gs` | `v1_ocr` 2, 3 | implemented, tested; no OCR provider configured (infrastructure only) |
| O7 | AI is data/permission-based; drafts need admin approval | `src/Assistant.gs`, `ai.*` routes | assistant tests in `integration`/`d7_authz` | implemented (see note 1) |
| O8 | Soldier never enters the admin app; dedicated form; personal number alone is not authentication | `src/Forms.gs`, `src/FormPage.html` | `v1_pentest`, form tests | implemented (see note 2) |
| M1 | Meetings+tasks for admin/commander only; soldiers refused even with direct API call | `src/Meetings.gs` | `pd6_meetings_tasks` "soldier / unknown / disabled" | implemented, tested |
| M2 | No standalone task creation; tasks only via meeting save | `src/Meetings.gs`, `src/Code.gs` (comment at line 171: deliberately NO `tasks.create`) | `pd6_meetings_tasks` "no standalone task creation" | implemented, tested |
| M3 | Task fields: title, one assignee, due date (+ optional time), priority low/normal/high/urgent, notes | `src/Meetings.gs` | validation + all-or-nothing tests | implemented, tested |
| M4 | Statuses open/in_progress/waiting/completed/cancelled; overdue derived, never stored; Asia/Jerusalem | `src/Meetings.gs` (STATUSES line 17) | 5x5 transition matrix, overdue + timezone tests | implemented, tested |
| M5 | Dashboard counts + filters (assignee, department, dates, status, meeting, priority); **no team filter/KPI** | `src/Meetings.gs` header comment line 14 | dashboard counts+filters test | implemented, tested |
| M6 | Assignee updates status/completes; admin too; author/admin cancel; reopen admin only; stale version = CONFLICT | `src/Meetings.gs` | "who may change status" test | implemented, tested |
| M7 | Full audit history (creation, reassignment, date/time, priority, status, completion, cancellation) with actor/time/old/new; immutable | `src/Meetings.gs`, audit | audit + history immutability tests | implemented, tested |
| M8 | Dashboard-only notifications; no email/SMS; no automatic reminder thresholds | `tasks.indicators` | indicators in dashboard tests | implemented (see note 1) |
| M9 | Double submit / retry never duplicates meeting, tasks, history; failure at every write point reports failure and hides data | `src/Meetings.gs` (`request_id`) | `pd6_meetings_tasks` duplicate-submit, failure-at-every-write-point | implemented, tested (separate from the new `idem_` mechanism) |
| M10 | Archived course blocks writes; data included in backup/restore | `src/Meetings.gs`, `src/Backup.gs` | archived-course test, backup test | implemented, tested |

## Notes / items to confirm (not guessed)
1. Rows marked "see note 1" are implemented in code, but I did not map each to a single named test in this pass; `docs/ui-source-comparison.json` lists, per action, which suites reference it.
2. The locked decision says a personal number alone is not sufficient authentication for the soldier form; the form uses a token credential (`Forms.gs`). Whether anonymous deployment of the form is acceptable is a **deployment decision** not taken here.
3. (Checked) `tasks.create` is NOT in `API_`; line 171 of `src/Code.gs` is a comment saying so. No action needed.
4. The PIN/registration/viewer decisions of issue #6 are **new** decisions (not in the handoff v4) and live in `backend_next/pin_auth.js` (not wired).
5. Everything above is verified only against the in-memory store; real Google behaviour: `docs/GOOGLE_TEST_VERIFICATION_REQUIRED.md`.
