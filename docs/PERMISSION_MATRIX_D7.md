# PERMISSION_MATRIX_D7 (owner decision F6)
Identity, role and courseScope are derived on the server (`Auth.context()` from the session; scope from active Assignments). Client-sent `role`, `email`, `courseScope`, `ctx`, nested `opts.courseId` are ignored (test D7-SPOOF).

| Caller | Course in scope | Course out of scope |
|---|---|---|
| ADMIN | allowed | allowed |
| COMMANDER (team / department / course assignment) | allowed — only the soldiers visible to him (team/department filter) | FORBIDDEN (no body) |
| Unknown / inactive user / no identity | refused | refused |

Six F6 routes (test D7-MATRIX, direct `X.api` calls, not through the UI):
| Route | Class | ADMIN | COMMANDER in scope | COMMANDER out of scope | Unknown / inactive |
|---|---|---|---|---|---|
| exams.summary | operational | ok | ok (visible soldiers) | FORBIDDEN | refused |
| dash.overview (exams block) | operational | ok | ok | FORBIDDEN | refused |
| readiness.summary | operational | ok | ok | FORBIDDEN | refused |
| nav.groups (group levels + soldier list) | operational; group levels carry no soldier identity and are N=5-suppressed | ok | ok | FORBIDDEN | refused |
| fitness.completion | operational | ok | ok | FORBIDDEN | refused |
| fitness.quality | administrative (config.edit) | ok | refused (stricter than the owner minimum; NOT widened, per "do not expand permissions") | FORBIDDEN | refused |

Result of the audit: all six were already secured server-side (guardCourse_ scope + Policy, visibility filter). **No production code was changed in D7**; the work is evidence (tests, route map) and eight new mutations (M227–M234).
Open question for the owner: the owner's matrix lists commander-in-scope as "allowed" for all six; `fitness.quality` is admin-only today. If a commander should read it, that is a permission widening and needs your explicit approval.
