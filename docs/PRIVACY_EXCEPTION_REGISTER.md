# Privacy exception register — FINAL TEST CANDIDATE (R5.2.16.4.4)

Rule (owner decision D2, MIN_GROUP = 5): a GROUP path never returns a figure backed by 1–4 distinct soldiers, never a soldier list, and never a value from which a hidden small side can be derived.
Classes: **A** explicit personal (the caller names one soldier, permission + scope checked) · **B** personal operational list/queue (authorised scope, an action screen by design) · **C** group (must satisfy D2, carries no personal list).
Every route in `tests/route_classes.json` is classified (test `D7-ROUTE-MAP`). Only the routes below return soldier-level data without D2 gating; everything else classified **G** is gated.

| Route | Class | Purpose | Information | Who may access | Why required | Tests proving no group leak |
|---|---|---|---|---|---|---|
| `readiness.summary` | **C** (was a mixed exception in REV3 — REMOVED) | status counts | counts only, all parts hidden if any part is 1–4 | `result.read` in scope | group view | `v1_tracking`, `r5_privacy_subcohort` #7, `r5_final_closure` F3/F8, mutation M241/M252 |
| `readiness.notEntered` | **B** | dashboard action queue "soldiers with no status" | soldier ids only (names come from the authorised `soldiers.list`) | `result.read`, scope applied (commander sees only his soldiers) | a commander must act on missing entries; the queue is not a count | `d7_authz` D7-LEAK-F6, `v1_pentest` real-id sweep, `r5_final_closure` F8 |
| `readiness.list` | **B** | per-soldier readiness records | records with status/dates | `result.read` in scope | operational recording | `d7_authz`, `v1_pentest` |
| `attendance.roll` | **B** | the roll of ONE event (who is absent / left early) | per-soldier rows | `result.read` in scope | taking and correcting attendance | `v1_tracking`, `uxqa_server` ATT-02/03, `r5_final_closure` F12 |
| `attendance.events` | **C** (was G with raw counts in REV3 — FIXED) | event list | per event: total, present/absent/early-exit counts ONLY when each side is 0 or ≥5 | `result.read` in scope | event navigation | `uxqa_server` ATT-01/02/03, `r5_final_closure` F12, mutation M247 |
| `alerts.list` | **B** | open alerts per soldier | alert rows with soldier | `result.read` in scope | alert handling | `v1_alerts`, `d7_authz`, `v1_pentest` |
| `alerts.counts` | **C** (was ungated in REV3 — FIXED) | alert totals for dashboard/home/assistant | red/yellow counts only when each is backed by 0 or ≥5 distinct soldiers, else `has_open` flag | `result.read` in scope | dashboard KPI | `r5_final_closure` F9/F13, mutation M246/M253 |
| `fitness.completion` | **B** | fitness data-gap action screen | one row per soldier (names, missing components) + the counts of THOSE rows | `result.read` in scope | fixing missing fitness data (a list is the purpose) | `d7_authz`, `v1_pentest`, `v105_missing`; dashboard KPI uses gated `completeness.fitness` instead (F2) |
| `fitness.quality` | **A** (admin only) | data-quality audit | per-record findings | admin | governance | `d7_authz` |
| `nav.list` `mk.list` `fitness.list` `exams.attempts` `marches.list` `events.list` `qual.assignments` | **B** | result lists | per-soldier rows | `result.read`/scope | recording / correction | `v1_pentest` real-id sweep, `d7_authz` |
| `nav/fitness/mk/exams/attendance/marches.summary` with `soldierId` | **A** | one soldier's summary | that soldier | permission + `scopeGate_` | soldier card | `v1_tracking`, `r5_privacy_subcohort` #10 |
| same routes WITHOUT `soldierId`, `nav.groups`, `qual.summary`, `dash.*`, `analytics.insights`, `reports.preview`, Assistant | **C** | group views | cohort-gated figures, no lists | scoped | dashboard / report | `r5_privacy_subcohort`, `r5_final_closure`, `uxqa_server` PRV-ROUTES, mutations M235–M254 |
| `dash.trends`, `dash.strengthsGaps` | **A** (reclassified from G) | one soldier's trend / strengths | requires `soldier_id` | permission + scope | soldier card | `d7_authz` route map |
| `tasks.indicators` | N/A | the caller's own task counters | no soldier data | caller | personal inbox | `PRV-ROUTES` |
| `soldiers.*`, `assess.*`, `notes.*`, `emergency.*`, `docs.*` | **A/P** | personal records | per soldier | per permission matrix | core function | `v1_private`, `d7_authz`, `v1_pentest` |

Residual risks (documented, not product-policy changes — owner may tighten):
1. Median and inter-quartile range of per-soldier fitness means (≥5 soldiers with a score, legal split) are order statistics of the cohort; for n = 5 or 9 a quartile equals one unnamed soldier's value. No minimum/maximum, no names.
2. A soldier-level list (class B) lets its reader count its rows; that is inherent in an action queue and limited to the reader's authorised scope.
3. Cross-surface differencing by a user who legitimately sees TWO different scopes (e.g. two commanders comparing notes outside the system) is outside the system.
