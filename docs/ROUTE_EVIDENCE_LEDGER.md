# 176-route evidence ledger (generated — do not edit)

Source: `scripts/build_route_ledger.js` from `src/Code.gs` API_ map, `tests/route_classes.json`, native sources and the calls recorded by the browser E2E (`E2E_CALLS_OUT`). Synthetic data only. **secured TEST E2E = NOT_RUN and deployed = NO for every row** (no secured backend exists yet).

**Summary:** {"total":185,"PASS_SYNTH_E2E":156,"API_ONLY_NOT_UI":0,"POLICY_BLOCKED":5,"interaction_verified":155,"IMPLEMENTED_NOT_E2E":4,"BLOCKED_NOT_CONNECTED":13,"NOT_IMPLEMENTED":7,"native_screen":175}

Markers: **PASS_SYNTH_E2E** = at least one successful API call made by the application UI code (`ui_origin_api_ok`, includes calls made automatically when a screen renders) — it is NOT by itself proof that a person (or Playwright) operated a control · **interaction_verified** (separate column/count) = at least one successful UI-origin call that started within 1.5 s after a *trusted* input event (real click/type/select/submit/keypress dispatched by the browser input pipeline) — a machine-correlated gesture, not a semantic proof of the intended action; the E2E scripts also read state back to check results · API_ONLY_NOT_UI = only the test hook (`window.__app.api`) succeeded · IMPLEMENTED_NOT_E2E = native code references the API but no successful browser call observed · BLOCKED_NOT_CONNECTED = missing external adapter, shown honestly · POLICY_BLOCKED = backend route exists but is intentionally not exposed natively (owner charter) and is NOT counted as completed · NOT_IMPLEMENTED = no native workflow. Cell format of `calls`: ui-origin/gesture-correlated/direct.

| # | Route | Group | Authz class | Native | Status | calls | interaction_verified | Negative authz seen | Note |
|---|---|---|---|---|---|---|---|---|---|

| 1 | `courses.list` | courses | N | yes | PASS_SYNTH_E2E | 88/14/4 | yes | no |  |
| 2 | `courses.org` | courses | N | yes | PASS_SYNTH_E2E | 73/6/6 | yes | no |  |
| 3 | `courses.create` | courses | A | yes | PASS_SYNTH_E2E | 1/1/6 | yes | no |  |
| 4 | `courses.archive` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 5 | `courses.reopen` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 6 | `courses.rename` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 7 | `users.list` | users | A | yes | PASS_SYNTH_E2E | 12/7/1 | yes | yes |  |
| 8 | `users.add` | users | A | yes | PASS_SYNTH_E2E | 1/1/1 | yes | yes |  |
| 9 | `users.set` | users | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 10 | `soldiers.list` | soldiers | O | yes | PASS_SYNTH_E2E | 220/72/18 | yes | yes |  |
| 11 | `soldiers.card` | soldiers | O | yes | PASS_SYNTH_E2E | 22/19/3 | yes | no |  |
| 12 | `soldiers.private` | soldiers | P | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 13 | `emergency.get` | emergency | P | yes | PASS_SYNTH_E2E | 22/20/0 | yes | yes |  |
| 14 | `emergency.set` | emergency | P | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 15 | `emergency.orphans` | emergency | A | yes | PASS_SYNTH_E2E | 10/6/0 | yes | no |  |
| 16 | `soldiers.create` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/16 | yes | yes |  |
| 17 | `soldiers.update` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 18 | `soldiers.reassign` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 19 | `soldiers.setActive` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 20 | `soldiers.cancel` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 21 | `soldiers.restore` | soldiers | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 22 | `nav.create` | nav | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 23 | `navevents.list` | navevents | ? | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 24 | `navevents.get` | navevents | ? | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 25 | `navevents.create` | navevents | ? | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 26 | `navevents.update` | navevents | ? | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 27 | `navevents.setStatus` | navevents | ? | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 28 | `navevents.legacy` | navevents | ? | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 29 | `navevents.adopt` | navevents | ? | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 30 | `nav.list` | nav | O | yes | PASS_SYNTH_E2E | 5/3/0 | yes | no |  |
| 31 | `nav.groups` | nav | O | yes | PASS_SYNTH_E2E | 5/3/0 | yes | no |  |
| 32 | `navtypes.list` | navtypes | N | yes | PASS_SYNTH_E2E | 7/5/1 | yes | no |  |
| 33 | `navtypes.create` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 34 | `navtypes.rename` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 35 | `navtypes.setActive` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 36 | `assignments.list` | assignments | A | yes | PASS_SYNTH_E2E | 14/7/9 | yes | yes |  |
| 37 | `assignments.mine` | assignments | N | yes | PASS_SYNTH_E2E | 1/0/2 | no | yes |  |
| 38 | `assignments.create` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 39 | `assignments.update` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 40 | `assignments.setActive` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/3 | yes | yes |  |
| 41 | `nav.summary` | nav | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 42 | `record.edit` | record | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 43 | `record.cancel` | record | O | yes | PASS_SYNTH_E2E | 2/2/1 | yes | no |  |
| 44 | `record.restore` | record | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 45 | `record.history` | record | O | yes | PASS_SYNTH_E2E | 1/1/2 | yes | no |  |
| 46 | `correction.request` | correction | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 47 | `correction.list` | correction | O | yes | PASS_SYNTH_E2E | 3/2/0 | yes | no |  |
| 48 | `correction.review` | correction | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 49 | `settings.list` | settings | N | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 50 | `settings.set` | settings | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 51 | `fitness.types` | fitness | N | yes | PASS_SYNTH_E2E | 19/11/8 | yes | no |  |
| 52 | `fitness.typeCreate` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 53 | `fitness.typeWeights` | fitness | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 54 | `fitness.typeActive` | fitness | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 55 | `fitness.typeVariant` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 56 | `fitness.draftSource` | fitness | A | yes | PASS_SYNTH_E2E | 15/7/0 | yes | no |  |
| 57 | `fitness.versions` | fitness | N | yes | PASS_SYNTH_E2E | 20/12/6 | yes | yes |  |
| 58 | `fitness.importDraft` | fitness | A | yes | PASS_SYNTH_E2E | 3/3/2 | yes | yes |  |
| 59 | `fitness.editRow` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 60 | `fitness.addTable` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 61 | `fitness.approve` | fitness | A | yes | PASS_SYNTH_E2E | 2/2/2 | yes | no |  |
| 62 | `fitness.create` | fitness | O | yes | PASS_SYNTH_E2E | 1/1/7 | yes | no |  |
| 63 | `fitness.preview` | fitness | N | yes | IMPLEMENTED_NOT_E2E | 0/0/0 | no | no |  |
| 64 | `fitness.reference` | fitness | N | yes | IMPLEMENTED_NOT_E2E | 0/0/0 | no | no |  |
| 65 | `fitness.list` | fitness | O | yes | PASS_SYNTH_E2E | 3/3/0 | yes | yes |  |
| 66 | `fitness.summary` | fitness | G | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 67 | `fitness.completion` | fitness | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 68 | `fitness.quality` | fitness | A | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 69 | `fitness.recompute` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 70 | `mk.create` | mk | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 71 | `mk.list` | mk | O | yes | PASS_SYNTH_E2E | 1/1/5 | yes | no |  |
| 72 | `mk.summary` | mk | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 73 | `exams.defs` | exams | N | yes | PASS_SYNTH_E2E | 10/6/1 | yes | no |  |
| 74 | `exams.defCreate` | exams | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 75 | `exams.defPass` | exams | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 76 | `exams.attempt` | exams | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 77 | `exams.attempts` | exams | O | yes | PASS_SYNTH_E2E | 7/3/0 | yes | no |  |
| 78 | `exams.meetings` | exams | O | yes | PASS_SYNTH_E2E | 7/3/0 | yes | no |  |
| 79 | `exams.summary` | exams | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 80 | `acttypes.list` | acttypes | N | yes | PASS_SYNTH_E2E | 9/5/2 | yes | no |  |
| 81 | `acttypes.create` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/2 | yes | no |  |
| 82 | `acttypes.rename` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 83 | `acttypes.setActive` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 84 | `attendance.create` | attendance | O | yes | PASS_SYNTH_E2E | 1/1/3 | yes | no |  |
| 85 | `attendance.events` | attendance | G | yes | PASS_SYNTH_E2E | 7/3/1 | yes | yes |  |
| 86 | `attendance.roll` | attendance | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 87 | `attendance.summary` | attendance | G | yes | PASS_SYNTH_E2E | 3/1/3 | yes | yes |  |
| 88 | `marches.create` | marches | O | yes | PASS_SYNTH_E2E | 5/5/2 | yes | yes |  |
| 89 | `marches.list` | marches | O | yes | PASS_SYNTH_E2E | 16/12/9 | yes | yes |  |
| 90 | `marches.summary` | marches | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 91 | `readiness.assess` | readiness | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 92 | `readiness.list` | readiness | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 93 | `readiness.summary` | readiness | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 94 | `readiness.notEntered` | readiness | O | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 95 | `events.create` | events | O | yes | PASS_SYNTH_E2E | 1/1/2 | yes | no |  |
| 96 | `events.list` | events | O | yes | PASS_SYNTH_E2E | 3/3/0 | yes | no |  |
| 97 | `qual.define` | qual | A | yes | PASS_SYNTH_E2E | 3/3/1 | yes | no |  |
| 98 | `qual.list` | qual | N | yes | PASS_SYNTH_E2E | 15/13/5 | yes | yes |  |
| 99 | `qual.setActive` | qual | A | yes | PASS_SYNTH_E2E | 2/2/1 | yes | no |  |
| 100 | `qual.postpone` | qual | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 101 | `qual.dueHistory` | qual | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 102 | `qual.assignments` | qual | O | yes | PASS_SYNTH_E2E | 15/13/4 | yes | no |  |
| 103 | `qual.update` | qual | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 104 | `qual.requestExclusion` | qual | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 105 | `qual.reviewExclusion` | qual | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 106 | `qual.summary` | qual | G | yes | PASS_SYNTH_E2E | 15/13/0 | yes | no |  |
| 107 | `assess.add` | assess | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 108 | `assess.list` | assess | P | yes | PASS_SYNTH_E2E | 24/21/0 | yes | no |  |
| 109 | `notes.save` | notes | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | yes |  |
| 110 | `notes.list` | notes | P | yes | PASS_SYNTH_E2E | 22/20/0 | yes | yes |  |
| 111 | `followups.create` | followups | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 112 | `followups.update` | followups | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 113 | `followups.list` | followups | O | yes | PASS_SYNTH_E2E | 149/70/0 | yes | yes |  |
| 114 | `favorites.toggle` | favorites | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 115 | `favorites.list` | favorites | O | yes | PASS_SYNTH_E2E | 21/19/0 | yes | no |  |
| 116 | `snote.add` | snote | O | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 117 | `snote.list` | snote | O | yes | PASS_SYNTH_E2E | 9/9/0 | yes | no |  |
| 118 | `snote.cancel` | snote | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 119 | `alerts.refresh` | alerts | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 120 | `alerts.list` | alerts | O | yes | PASS_SYNTH_E2E | 9/6/1 | yes | no |  |
| 121 | `alerts.handle` | alerts | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 122 | `alerts.counts` | alerts | G | yes | PASS_SYNTH_E2E | 160/67/0 | yes | no |  |
| 123 | `forms.generalLink` | forms | N | yes | PASS_SYNTH_E2E | 3/2/0 | yes | no |  |
| 124 | `forms.createLink` | forms | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 125 | `forms.list` | forms | O | yes | PASS_SYNTH_E2E | 4/3/1 | yes | no |  |
| 126 | `forms.review` | forms | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 127 | `dash.home` | dash | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 128 | `dash.overview` | dash | O | yes | PASS_SYNTH_E2E | 8/2/0 | yes | no |  |
| 129 | `dash.groups` | dash | G | yes | PASS_SYNTH_E2E | 16/4/0 | yes | no |  |
| 130 | `dash.compareCourses` | dash | G | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 131 | `dash.trends` | dash | O | no | POLICY_BLOCKED | 0/0/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: owner charter 2026-11-20 (docs/OWNER_CURRENT_CHARTER_2026-11-20.md) allows group-level analytics only — no per-soldier trends. Backend route preserved for an owner-approved disposition; no native screen calls it. |
| 132 | `dash.strengthsGaps` | dash | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 133 | `analytics.insights` | analytics | G | yes | PASS_SYNTH_E2E | 161/68/0 | yes | no |  |
| 134 | `reports.build` | reports | O | yes | POLICY_BLOCKED | 1/1/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: returns per-soldier rows (names, personal numbers, individual scores); owner charter 2026-11-20 allows group-level reporting only (N>=5). The group-safe report is reports.preview. Not counted as completed. |
| 135 | `reports.preview` | reports | G | yes | PASS_SYNTH_E2E | 4/2/0 | yes | no |  |
| 136 | `reports.generate` | reports | O | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (real PDF/XLSX, encrypted at rest): tests/report_export.js + scripts/e2e_report_export_browser.js, see docs/REPORT_EXPORT_TEST.md |
| 137 | `reports.exportAuthorize` | reports | A | yes | IMPLEMENTED_NOT_E2E | 0/0/0 | no | no |  |
| 138 | `reports.exportComplete` | reports | A | yes | IMPLEMENTED_NOT_E2E | 0/0/0 | no | no |  |
| 139 | `reports.fullExport` | reports | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (real multi-sheet XLSX): tests/report_export.js + scripts/e2e_report_export_browser.js, see docs/REPORT_EXPORT_TEST.md |
| 140 | `reports.download` | reports | O | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (real PDF/XLSX, encrypted at rest): tests/report_export.js + scripts/e2e_report_export_browser.js, see docs/REPORT_EXPORT_TEST.md |
| 141 | `reports.jobs` | reports | O | yes | PASS_SYNTH_E2E | 4/2/0 | yes | no |  |
| 142 | `import.start` | import | A | yes | PASS_SYNTH_E2E | 4/4/0 | yes | yes |  |
| 143 | `import.preview` | import | A | yes | PASS_SYNTH_E2E | 7/7/0 | yes | no |  |
| 144 | `import.decide` | import | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 145 | `import.commit` | import | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 146 | `import.cancel` | import | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 147 | `import.jobs` | import | A | yes | PASS_SYNTH_E2E | 13/6/5 | yes | yes |  |
| 148 | `docs.upload` | docs | P | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (content-guarded, encrypted, scope-checked): tests/documents_server.js + scripts/e2e_documents_browser.js, see docs/DOCUMENTS_TEST.md |
| 149 | `docs.list` | docs | P | yes | PASS_SYNTH_E2E | 40/14/8 | yes | no |  |
| 150 | `docs.download` | docs | P | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (GET /api/download/document/:id, byte-identical): see docs/DOCUMENTS_TEST.md |
| 151 | `docs.requestLink` | docs | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 152 | `docs.reviewLink` | docs | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 153 | `docs.pendingLinks` | docs | A | yes | PASS_SYNTH_E2E | 12/4/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 154 | `docs.attachEvidence` | docs | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 155 | `docs.evidence` | docs | P | yes | PASS_SYNTH_E2E | 3/3/3 | yes | no | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 156 | `ocr.start` | ocr | A | yes | BLOCKED_NOT_CONNECTED | 1/1/0 | no | yes | needs OCR/Drive adapter |
| 157 | `ocr.rows` | ocr | A | yes | PASS_SYNTH_E2E | 4/4/2 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 158 | `ocr.editRow` | ocr | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 159 | `ocr.approveRow` | ocr | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 160 | `ocr.rejectRow` | ocr | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes | UI flow click-tested on synthetic fixture rows (no upload/OCR provider connected) — proves the review/link logic, not a real file or OCR pipeline |
| 161 | `ai.ask` | ai | O | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 162 | `ai.draft` | ai | O | yes | POLICY_BLOCKED | 3/3/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: generates an individual per-soldier assessment, excluded from analytics by the owner charter 2026-11-20. Group-only insights stay in analytics.insights. Not counted as completed. |
| 163 | `ai.drafts` | ai | O | yes | POLICY_BLOCKED | 13/5/5 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: lists per-soldier generated assessments (owner charter 2026-11-20). Not counted as completed. |
| 164 | `ai.reviewDraft` | ai | A | yes | POLICY_BLOCKED | 2/2/0 | no | yes | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: would make an individual generated assessment official (owner charter 2026-11-20). Not counted as completed. |
| 165 | `backup.create` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (admin-only; state + encrypted report files): tests/backup_restore.js + scripts/e2e_backup_restore_browser.js, see docs/BACKUP_RESTORE_TEST.md |
| 166 | `backup.list` | backup | A | yes | PASS_SYNTH_E2E | 11/4/1 | yes | no |  |
| 167 | `backup.verify` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (admin-only; state + encrypted report files): tests/backup_restore.js + scripts/e2e_backup_restore_browser.js, see docs/BACKUP_RESTORE_TEST.md |
| 168 | `backup.plan` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (admin-only; state + encrypted report files): tests/backup_restore.js + scripts/e2e_backup_restore_browser.js, see docs/BACKUP_RESTORE_TEST.md |
| 169 | `backup.restore` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (admin-only; state + encrypted report files): tests/backup_restore.js + scripts/e2e_backup_restore_browser.js, see docs/BACKUP_RESTORE_TEST.md |
| 170 | `backup.recover` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (admin-only; state + encrypted report files): tests/backup_restore.js + scripts/e2e_backup_restore_browser.js, see docs/BACKUP_RESTORE_TEST.md |
| 171 | `preflight.run` | preflight | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 172 | `preflight.last` | preflight | A | yes | PASS_SYNTH_E2E | 11/4/0 | yes | yes |  |
| 173 | `backup.prune` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | public demo: no file engine (nothing faked). WORKS FOR REAL only in the private TEST server / Windows package (admin-only; state + encrypted report files): tests/backup_restore.js + scripts/e2e_backup_restore_browser.js, see docs/BACKUP_RESTORE_TEST.md |
| 174 | `migration.run` | migration | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | mutating schema migration is NOT exposed from the UI in this release (manager gate: plan/dry-run only): needs an approved private server and a separately reviewed migration plan; the UI makes zero migration.run calls |
| 175 | `meetings.list` | meetings | N | yes | PASS_SYNTH_E2E | 6/3/2 | yes | no |  |
| 176 | `meetings.get` | meetings | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 177 | `meetings.options` | meetings | N | yes | PASS_SYNTH_E2E | 2/1/0 | yes | no |  |
| 178 | `meetings.save` | meetings | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 179 | `tasks.list` | tasks | N | yes | PASS_SYNTH_E2E | 8/8/1 | yes | no |  |
| 180 | `tasks.get` | tasks | N | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 181 | `tasks.setStatus` | tasks | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 182 | `tasks.indicators` | tasks | G | yes | PASS_SYNTH_E2E | 160/67/0 | yes | no |  |
| 183 | `meetings.integrity` | meetings | N | yes | PASS_SYNTH_E2E | 9/4/1 | yes | no |  |
| 184 | `meetings.auditRepair` | meetings | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 185 | `audit.list` | audit | A | yes | PASS_SYNTH_E2E | 7/3/5 | yes | yes |  |
