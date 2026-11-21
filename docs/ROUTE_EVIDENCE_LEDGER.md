# 177-route evidence ledger (generated — do not edit)

Source: `scripts/build_route_ledger.js` from `src/Code.gs` API_ map, `tests/route_classes.json`, native sources and the calls recorded by the browser E2E (`E2E_CALLS_OUT`). Synthetic data only. **secured TEST E2E = NOT_RUN and deployed = NO for every row** (no secured backend exists yet).

**Summary:** {"total":177,"PASS_SYNTH_E2E":159,"API_ONLY_NOT_UI":0,"POLICY_BLOCKED":5,"interaction_verified":159,"IMPLEMENTED_NOT_E2E":0,"BLOCKED_NOT_CONNECTED":13,"NOT_IMPLEMENTED":0,"native_screen":166}

Markers: **PASS_SYNTH_E2E** = at least one successful API call made by the application UI code (`ui_origin_api_ok`, includes calls made automatically when a screen renders) — it is NOT by itself proof that a person (or Playwright) operated a control · **interaction_verified** (separate column/count) = at least one successful UI-origin call that started within 1.5 s after a *trusted* input event (real click/type/select/submit/keypress dispatched by the browser input pipeline) — a machine-correlated gesture, not a semantic proof of the intended action; the E2E scripts also read state back to check results · API_ONLY_NOT_UI = only the test hook (`window.__app.api`) succeeded · IMPLEMENTED_NOT_E2E = native code references the API but no successful browser call observed · BLOCKED_NOT_CONNECTED = missing external adapter, shown honestly · POLICY_BLOCKED = backend route exists but is intentionally not exposed natively (owner charter) and is NOT counted as completed · NOT_IMPLEMENTED = no native workflow. Cell format of `calls`: ui-origin/gesture-correlated/direct.

| # | Route | Group | Authz class | Native | Status | calls | interaction_verified | Negative authz seen | Note |
|---|---|---|---|---|---|---|---|---|---|

| 1 | `courses.list` | courses | N | yes | PASS_SYNTH_E2E | 92/14/4 | yes | no |  |
| 2 | `courses.org` | courses | N | yes | PASS_SYNTH_E2E | 77/6/7 | yes | no |  |
| 3 | `courses.create` | courses | A | yes | PASS_SYNTH_E2E | 1/1/7 | yes | no |  |
| 4 | `courses.archive` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 5 | `courses.reopen` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 6 | `courses.rename` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 7 | `users.list` | users | A | yes | PASS_SYNTH_E2E | 12/7/1 | yes | yes |  |
| 8 | `users.add` | users | A | yes | PASS_SYNTH_E2E | 1/1/1 | yes | yes |  |
| 9 | `users.set` | users | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 10 | `soldiers.list` | soldiers | O | yes | PASS_SYNTH_E2E | 254/93/18 | yes | yes |  |
| 11 | `soldiers.card` | soldiers | O | yes | PASS_SYNTH_E2E | 22/19/3 | yes | no |  |
| 12 | `soldiers.private` | soldiers | P | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 13 | `emergency.get` | emergency | P | yes | PASS_SYNTH_E2E | 22/20/0 | yes | yes |  |
| 14 | `emergency.set` | emergency | P | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 15 | `emergency.orphans` | emergency | A | yes | PASS_SYNTH_E2E | 10/6/0 | yes | no |  |
| 16 | `soldiers.create` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/19 | yes | yes |  |
| 17 | `soldiers.update` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 18 | `soldiers.reassign` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 19 | `soldiers.setActive` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 20 | `soldiers.cancel` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 21 | `soldiers.restore` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 22 | `nav.create` | nav | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 23 | `nav.list` | nav | O | yes | PASS_SYNTH_E2E | 5/3/0 | yes | no |  |
| 24 | `nav.groups` | nav | O | yes | PASS_SYNTH_E2E | 5/3/0 | yes | no |  |
| 25 | `navtypes.list` | navtypes | N | yes | PASS_SYNTH_E2E | 7/5/1 | yes | no |  |
| 26 | `navtypes.create` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 27 | `navtypes.rename` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 28 | `navtypes.setActive` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 29 | `assignments.list` | assignments | A | yes | PASS_SYNTH_E2E | 14/7/9 | yes | yes |  |
| 30 | `assignments.mine` | assignments | N | yes | PASS_SYNTH_E2E | 72/4/2 | yes | yes |  |
| 31 | `assignments.create` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 32 | `assignments.update` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 33 | `assignments.setActive` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/3 | yes | yes |  |
| 34 | `nav.summary` | nav | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 35 | `record.edit` | record | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 36 | `record.cancel` | record | O | yes | PASS_SYNTH_E2E | 2/2/1 | yes | no |  |
| 37 | `record.restore` | record | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 38 | `record.history` | record | O | yes | PASS_SYNTH_E2E | 1/1/2 | yes | no |  |
| 39 | `correction.request` | correction | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 40 | `correction.list` | correction | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 41 | `correction.review` | correction | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 42 | `settings.list` | settings | N | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 43 | `settings.set` | settings | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 44 | `fitness.types` | fitness | N | yes | PASS_SYNTH_E2E | 25/14/9 | yes | no |  |
| 45 | `fitness.typeCreate` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/1 | yes | yes |  |
| 46 | `fitness.typeWeights` | fitness | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 47 | `fitness.typeActive` | fitness | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 48 | `fitness.typeVariant` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 49 | `fitness.draftSource` | fitness | A | yes | PASS_SYNTH_E2E | 15/7/0 | yes | no |  |
| 50 | `fitness.versions` | fitness | N | yes | PASS_SYNTH_E2E | 20/12/6 | yes | yes |  |
| 51 | `fitness.importDraft` | fitness | A | yes | PASS_SYNTH_E2E | 3/3/3 | yes | yes |  |
| 52 | `fitness.editRow` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 53 | `fitness.addTable` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 54 | `fitness.approve` | fitness | A | yes | PASS_SYNTH_E2E | 2/2/3 | yes | no |  |
| 55 | `fitness.create` | fitness | O | yes | PASS_SYNTH_E2E | 2/2/7 | yes | no |  |
| 56 | `fitness.preview` | fitness | N | yes | PASS_SYNTH_E2E | 11/11/4 | yes | no |  |
| 57 | `fitness.reference` | fitness | N | yes | PASS_SYNTH_E2E | 3/3/1 | yes | no |  |
| 58 | `fitness.list` | fitness | O | yes | PASS_SYNTH_E2E | 5/5/3 | yes | yes |  |
| 59 | `fitness.summary` | fitness | G | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 60 | `fitness.completion` | fitness | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 61 | `fitness.quality` | fitness | A | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 62 | `fitness.recompute` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 63 | `mk.create` | mk | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 64 | `mk.list` | mk | O | yes | PASS_SYNTH_E2E | 1/1/5 | yes | no |  |
| 65 | `mk.summary` | mk | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 66 | `exams.defs` | exams | N | yes | PASS_SYNTH_E2E | 10/6/1 | yes | no |  |
| 67 | `exams.defCreate` | exams | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 68 | `exams.defPass` | exams | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 69 | `exams.attempt` | exams | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 70 | `exams.attempts` | exams | O | yes | PASS_SYNTH_E2E | 7/3/0 | yes | no |  |
| 71 | `exams.meetings` | exams | O | yes | PASS_SYNTH_E2E | 7/3/0 | yes | no |  |
| 72 | `exams.summary` | exams | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 73 | `acttypes.list` | acttypes | N | yes | PASS_SYNTH_E2E | 11/7/2 | yes | no |  |
| 74 | `acttypes.create` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/2 | yes | no |  |
| 75 | `acttypes.rename` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 76 | `acttypes.setActive` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 77 | `attendance.create` | attendance | O | yes | PASS_SYNTH_E2E | 1/1/3 | yes | no |  |
| 78 | `attendance.events` | attendance | G | yes | PASS_SYNTH_E2E | 9/5/1 | yes | yes |  |
| 79 | `attendance.roll` | attendance | O | yes | PASS_SYNTH_E2E | 2/2/1 | yes | no |  |
| 80 | `attendance.summary` | attendance | G | yes | PASS_SYNTH_E2E | 3/1/3 | yes | yes |  |
| 81 | `marches.create` | marches | O | yes | PASS_SYNTH_E2E | 6/6/4 | yes | yes |  |
| 82 | `marches.list` | marches | O | yes | PASS_SYNTH_E2E | 20/16/11 | yes | yes |  |
| 83 | `marches.roll` | marches | O | yes | PASS_SYNTH_E2E | 7/7/4 | yes | no |  |
| 84 | `marches.summary` | marches | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 85 | `readiness.assess` | readiness | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 86 | `readiness.list` | readiness | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 87 | `readiness.summary` | readiness | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 88 | `readiness.notEntered` | readiness | O | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 89 | `events.create` | events | O | yes | PASS_SYNTH_E2E | 1/1/2 | yes | no |  |
| 90 | `events.list` | events | O | yes | PASS_SYNTH_E2E | 3/3/0 | yes | no |  |
| 91 | `qual.define` | qual | A | yes | PASS_SYNTH_E2E | 3/3/1 | yes | no |  |
| 92 | `qual.list` | qual | N | yes | PASS_SYNTH_E2E | 15/13/5 | yes | yes |  |
| 93 | `qual.setActive` | qual | A | yes | PASS_SYNTH_E2E | 2/2/1 | yes | no |  |
| 94 | `qual.postpone` | qual | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 95 | `qual.dueHistory` | qual | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 96 | `qual.assignments` | qual | O | yes | PASS_SYNTH_E2E | 15/13/4 | yes | no |  |
| 97 | `qual.update` | qual | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 98 | `qual.requestExclusion` | qual | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 99 | `qual.reviewExclusion` | qual | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 100 | `qual.summary` | qual | G | yes | PASS_SYNTH_E2E | 15/13/0 | yes | no |  |
| 101 | `assess.add` | assess | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 102 | `assess.list` | assess | P | yes | PASS_SYNTH_E2E | 24/21/0 | yes | no |  |
| 103 | `notes.save` | notes | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | yes |  |
| 104 | `notes.list` | notes | P | yes | PASS_SYNTH_E2E | 22/20/0 | yes | yes |  |
| 105 | `followups.create` | followups | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 106 | `followups.update` | followups | O | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 107 | `followups.list` | followups | O | yes | PASS_SYNTH_E2E | 180/87/0 | yes | yes |  |
| 108 | `favorites.toggle` | favorites | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 109 | `favorites.list` | favorites | O | yes | PASS_SYNTH_E2E | 21/19/0 | yes | no |  |
| 110 | `snote.add` | snote | O | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 111 | `snote.list` | snote | O | yes | PASS_SYNTH_E2E | 10/10/0 | yes | no |  |
| 112 | `snote.cancel` | snote | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 113 | `alerts.refresh` | alerts | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 114 | `alerts.list` | alerts | O | yes | PASS_SYNTH_E2E | 9/6/1 | yes | no |  |
| 115 | `alerts.handle` | alerts | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 116 | `alerts.counts` | alerts | G | yes | PASS_SYNTH_E2E | 189/83/0 | yes | no |  |
| 117 | `forms.generalLink` | forms | N | yes | PASS_SYNTH_E2E | 3/2/0 | yes | no |  |
| 118 | `forms.createLink` | forms | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 119 | `forms.list` | forms | O | yes | PASS_SYNTH_E2E | 4/3/1 | yes | no |  |
| 120 | `forms.review` | forms | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 121 | `dash.home` | dash | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 122 | `dash.overview` | dash | O | yes | PASS_SYNTH_E2E | 8/2/0 | yes | no |  |
| 123 | `dash.groups` | dash | G | yes | PASS_SYNTH_E2E | 16/4/0 | yes | no |  |
| 124 | `dash.compareCourses` | dash | G | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 125 | `dash.trends` | dash | O | no | POLICY_BLOCKED | 0/0/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: owner charter 2026-11-20 (docs/OWNER_CURRENT_CHARTER_2026-11-20.md) allows group-level analytics only — no per-soldier trends. Backend route preserved for an owner-approved disposition; no native screen calls it. |
| 126 | `dash.strengthsGaps` | dash | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 127 | `analytics.insights` | analytics | G | yes | PASS_SYNTH_E2E | 193/85/0 | yes | no |  |
| 128 | `reports.build` | reports | O | no | POLICY_BLOCKED | 0/0/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: returns per-soldier rows (names, personal numbers, individual scores); owner charter 2026-11-20 allows group-level reporting only (N>=5). The group-safe report is reports.preview. Not counted as completed. |
| 129 | `reports.preview` | reports | G | yes | PASS_SYNTH_E2E | 6/2/1 | yes | no |  |
| 130 | `reports.generate` | reports | O | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (real PDF/XLSX, encrypted at rest): tests/report_export.js + scripts/e2e_report_export_browser.js, see docs/REPORT_EXPORT_TEST.md |
| 131 | `reports.fullExport` | reports | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (real multi-sheet XLSX): tests/report_export.js + scripts/e2e_report_export_browser.js, see docs/REPORT_EXPORT_TEST.md |
| 132 | `reports.download` | reports | O | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (real PDF/XLSX, encrypted at rest): tests/report_export.js + scripts/e2e_report_export_browser.js, see docs/REPORT_EXPORT_TEST.md |
| 133 | `reports.jobs` | reports | O | yes | PASS_SYNTH_E2E | 6/2/0 | yes | no |  |
| 134 | `import.start` | import | A | yes | PASS_SYNTH_E2E | 4/4/0 | yes | yes |  |
| 135 | `import.preview` | import | A | yes | PASS_SYNTH_E2E | 7/7/0 | yes | no |  |
| 136 | `import.decide` | import | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 137 | `import.commit` | import | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 138 | `import.cancel` | import | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 139 | `import.jobs` | import | A | yes | PASS_SYNTH_E2E | 13/5/5 | yes | yes |  |
| 140 | `docs.upload` | docs | P | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive file storage |
| 141 | `docs.list` | docs | P | yes | PASS_SYNTH_E2E | 43/16/8 | yes | no |  |
| 142 | `docs.download` | docs | P | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive file storage |
| 143 | `docs.requestLink` | docs | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 144 | `docs.reviewLink` | docs | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 145 | `docs.pendingLinks` | docs | A | yes | PASS_SYNTH_E2E | 12/4/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 146 | `docs.attachEvidence` | docs | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 147 | `docs.evidence` | docs | P | yes | PASS_SYNTH_E2E | 6/6/3 | yes | no | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 148 | `ocr.start` | ocr | A | yes | BLOCKED_NOT_CONNECTED | 1/1/0 | no | yes | needs OCR/Drive adapter |
| 149 | `ocr.rows` | ocr | A | yes | PASS_SYNTH_E2E | 4/4/2 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 150 | `ocr.editRow` | ocr | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 151 | `ocr.approveRow` | ocr | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 152 | `ocr.rejectRow` | ocr | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 153 | `ai.ask` | ai | O | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 154 | `ai.draft` | ai | O | no | POLICY_BLOCKED | 0/0/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: generates an individual per-soldier assessment, excluded from analytics by the owner charter 2026-11-20. Group-only insights stay in analytics.insights. Not counted as completed. |
| 155 | `ai.drafts` | ai | O | no | POLICY_BLOCKED | 0/0/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: lists per-soldier generated assessments (owner charter 2026-11-20). Not counted as completed. |
| 156 | `ai.reviewDraft` | ai | A | no | POLICY_BLOCKED | 0/0/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: would make an individual generated assessment official (owner charter 2026-11-20). Not counted as completed. |
| 157 | `backup.create` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | needs Drive/Spreadsheet adapter |
| 158 | `backup.list` | backup | A | yes | PASS_SYNTH_E2E | 11/4/1 | yes | no |  |
| 159 | `backup.verify` | backup | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive adapter |
| 160 | `backup.plan` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | needs the private backup file (Drive adapter) — plan is read-only once storage is connected |
| 161 | `backup.restore` | backup | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive adapter |
| 162 | `backup.recover` | backup | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive adapter |
| 163 | `preflight.run` | preflight | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 164 | `preflight.last` | preflight | A | yes | PASS_SYNTH_E2E | 11/4/0 | yes | yes |  |
| 165 | `backup.prune` | backup | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive adapter |
| 166 | `migration.run` | migration | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | mutating schema migration is NOT exposed from the UI in this release (manager gate: plan/dry-run only): needs an approved private server and a separately reviewed migration plan; the UI makes zero migration.run calls |
| 167 | `meetings.list` | meetings | N | yes | PASS_SYNTH_E2E | 18/15/6 | yes | no |  |
| 168 | `meetings.get` | meetings | N | yes | PASS_SYNTH_E2E | 9/9/3 | yes | no |  |
| 169 | `meetings.options` | meetings | N | yes | PASS_SYNTH_E2E | 9/8/0 | yes | no |  |
| 170 | `meetings.save` | meetings | A | yes | PASS_SYNTH_E2E | 8/8/1 | yes | no |  |
| 171 | `tasks.list` | tasks | N | yes | PASS_SYNTH_E2E | 23/19/6 | yes | no |  |
| 172 | `tasks.get` | tasks | N | yes | PASS_SYNTH_E2E | 3/3/0 | yes | no |  |
| 173 | `tasks.setStatus` | tasks | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 174 | `tasks.indicators` | tasks | G | yes | PASS_SYNTH_E2E | 189/83/0 | yes | no |  |
| 175 | `meetings.integrity` | meetings | N | yes | PASS_SYNTH_E2E | 12/7/1 | yes | no |  |
| 176 | `meetings.auditRepair` | meetings | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 177 | `audit.list` | audit | A | yes | PASS_SYNTH_E2E | 7/3/5 | yes | yes |  |
