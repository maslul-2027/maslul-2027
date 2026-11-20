# 174-route evidence ledger (generated — do not edit)

Source: `scripts/build_route_ledger.js` from `src/Code.gs` API_ map, `tests/route_classes.json`, native sources and the calls recorded by the browser E2E (`E2E_CALLS_OUT`). Synthetic data only. **secured TEST E2E = NOT_RUN and deployed = NO for every row** (no secured backend exists yet).

**Summary:** {"total":174,"PASS_SYNTH_E2E":142,"API_ONLY_NOT_UI":0,"POLICY_BLOCKED":1,"interaction_verified":139,"IMPLEMENTED_NOT_E2E":0,"BLOCKED_NOT_CONNECTED":11,"NOT_IMPLEMENTED":20,"native_screen":145}

Markers: **PASS_SYNTH_E2E** = at least one successful API call made by the application UI code (`ui_origin_api_ok`, includes calls made automatically when a screen renders) — it is NOT by itself proof that a person (or Playwright) operated a control · **interaction_verified** (separate column/count) = at least one successful UI-origin call that started within 1.5 s after a *trusted* input event (real click/type/select/submit/keypress dispatched by the browser input pipeline) — a machine-correlated gesture, not a semantic proof of the intended action; the E2E scripts also read state back to check results · API_ONLY_NOT_UI = only the test hook (`window.__app.api`) succeeded · IMPLEMENTED_NOT_E2E = native code references the API but no successful browser call observed · BLOCKED_NOT_CONNECTED = missing external adapter, shown honestly · POLICY_BLOCKED = backend route exists but is intentionally not exposed natively (owner charter) and is NOT counted as completed · NOT_IMPLEMENTED = no native workflow. Cell format of `calls`: ui-origin/gesture-correlated/direct.

| # | Route | Group | Authz class | Native | Status | calls | interaction_verified | Negative authz seen | Note |
|---|---|---|---|---|---|---|---|---|---|

| 1 | `courses.list` | courses | N | yes | PASS_SYNTH_E2E | 61/14/4 | yes | no |  |
| 2 | `courses.org` | courses | N | yes | PASS_SYNTH_E2E | 46/6/5 | yes | no |  |
| 3 | `courses.create` | courses | A | yes | PASS_SYNTH_E2E | 1/1/6 | yes | no |  |
| 4 | `courses.archive` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 5 | `courses.reopen` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 6 | `courses.rename` | courses | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 7 | `users.list` | users | A | yes | PASS_SYNTH_E2E | 12/7/1 | yes | yes |  |
| 8 | `users.add` | users | A | yes | PASS_SYNTH_E2E | 1/1/1 | yes | yes |  |
| 9 | `users.set` | users | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 10 | `soldiers.list` | soldiers | O | yes | PASS_SYNTH_E2E | 162/64/7 | yes | yes |  |
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
| 23 | `nav.list` | nav | O | yes | PASS_SYNTH_E2E | 5/3/0 | yes | no |  |
| 24 | `nav.groups` | nav | O | yes | PASS_SYNTH_E2E | 5/3/0 | yes | no |  |
| 25 | `navtypes.list` | navtypes | N | yes | PASS_SYNTH_E2E | 7/5/1 | yes | no |  |
| 26 | `navtypes.create` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 27 | `navtypes.rename` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 28 | `navtypes.setActive` | navtypes | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 29 | `assignments.list` | assignments | A | yes | PASS_SYNTH_E2E | 14/7/9 | yes | yes |  |
| 30 | `assignments.mine` | assignments | N | yes | PASS_SYNTH_E2E | 1/0/2 | no | yes |  |
| 31 | `assignments.create` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 32 | `assignments.update` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 33 | `assignments.setActive` | assignments | A | yes | PASS_SYNTH_E2E | 1/1/3 | yes | yes |  |
| 34 | `nav.summary` | nav | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 35 | `record.edit` | record | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 36 | `record.cancel` | record | O | yes | PASS_SYNTH_E2E | 2/2/1 | yes | no |  |
| 37 | `record.restore` | record | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 38 | `record.history` | record | O | yes | PASS_SYNTH_E2E | 1/1/2 | yes | no |  |
| 39 | `correction.request` | correction | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 40 | `correction.list` | correction | O | yes | PASS_SYNTH_E2E | 3/2/0 | yes | no |  |
| 41 | `correction.review` | correction | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 42 | `settings.list` | settings | N | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 43 | `settings.set` | settings | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 44 | `fitness.types` | fitness | N | yes | PASS_SYNTH_E2E | 19/11/8 | yes | no |  |
| 45 | `fitness.typeCreate` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 46 | `fitness.typeWeights` | fitness | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 47 | `fitness.typeActive` | fitness | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 48 | `fitness.typeVariant` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 49 | `fitness.draftSource` | fitness | A | yes | PASS_SYNTH_E2E | 15/7/0 | yes | no |  |
| 50 | `fitness.versions` | fitness | N | yes | PASS_SYNTH_E2E | 20/12/6 | yes | yes |  |
| 51 | `fitness.importDraft` | fitness | A | yes | PASS_SYNTH_E2E | 3/3/2 | yes | yes |  |
| 52 | `fitness.editRow` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 53 | `fitness.addTable` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 54 | `fitness.approve` | fitness | A | yes | PASS_SYNTH_E2E | 2/2/2 | yes | no |  |
| 55 | `fitness.create` | fitness | O | yes | PASS_SYNTH_E2E | 1/1/7 | yes | no |  |
| 56 | `fitness.list` | fitness | O | yes | PASS_SYNTH_E2E | 3/3/0 | yes | yes |  |
| 57 | `fitness.summary` | fitness | G | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 58 | `fitness.completion` | fitness | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 59 | `fitness.quality` | fitness | A | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 60 | `fitness.recompute` | fitness | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 61 | `mk.create` | mk | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 62 | `mk.list` | mk | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 63 | `mk.summary` | mk | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 64 | `exams.defs` | exams | N | yes | PASS_SYNTH_E2E | 10/6/1 | yes | no |  |
| 65 | `exams.defCreate` | exams | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 66 | `exams.defPass` | exams | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 67 | `exams.attempt` | exams | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 68 | `exams.attempts` | exams | O | yes | PASS_SYNTH_E2E | 7/3/0 | yes | no |  |
| 69 | `exams.meetings` | exams | O | yes | PASS_SYNTH_E2E | 7/3/0 | yes | no |  |
| 70 | `exams.summary` | exams | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 71 | `acttypes.list` | acttypes | N | yes | PASS_SYNTH_E2E | 9/5/2 | yes | no |  |
| 72 | `acttypes.create` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/2 | yes | no |  |
| 73 | `acttypes.rename` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 74 | `acttypes.setActive` | acttypes | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 75 | `attendance.create` | attendance | O | yes | PASS_SYNTH_E2E | 1/1/3 | yes | no |  |
| 76 | `attendance.events` | attendance | G | yes | PASS_SYNTH_E2E | 7/3/1 | yes | yes |  |
| 77 | `attendance.roll` | attendance | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 78 | `attendance.summary` | attendance | G | yes | PASS_SYNTH_E2E | 3/1/3 | yes | yes |  |
| 79 | `marches.create` | marches | O | yes | PASS_SYNTH_E2E | 5/5/2 | yes | yes |  |
| 80 | `marches.list` | marches | O | yes | PASS_SYNTH_E2E | 16/12/9 | yes | yes |  |
| 81 | `marches.summary` | marches | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 82 | `readiness.assess` | readiness | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 83 | `readiness.list` | readiness | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 84 | `readiness.summary` | readiness | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 85 | `readiness.notEntered` | readiness | O | yes | PASS_SYNTH_E2E | 3/1/1 | yes | no |  |
| 86 | `events.create` | events | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 87 | `events.list` | events | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 88 | `qual.define` | qual | A | yes | PASS_SYNTH_E2E | 3/3/0 | yes | no |  |
| 89 | `qual.list` | qual | N | yes | PASS_SYNTH_E2E | 12/12/5 | yes | yes |  |
| 90 | `qual.setActive` | qual | A | yes | PASS_SYNTH_E2E | 2/2/1 | yes | no |  |
| 91 | `qual.postpone` | qual | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 92 | `qual.dueHistory` | qual | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 93 | `qual.assignments` | qual | O | yes | PASS_SYNTH_E2E | 12/12/3 | yes | no |  |
| 94 | `qual.update` | qual | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 95 | `qual.requestExclusion` | qual | O | yes | PASS_SYNTH_E2E | 1/1/1 | yes | no |  |
| 96 | `qual.reviewExclusion` | qual | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 97 | `qual.summary` | qual | G | yes | PASS_SYNTH_E2E | 12/12/0 | yes | no |  |
| 98 | `assess.add` | assess | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 99 | `assess.list` | assess | P | yes | PASS_SYNTH_E2E | 24/21/0 | yes | no |  |
| 100 | `notes.save` | notes | P | yes | PASS_SYNTH_E2E | 2/2/0 | yes | yes |  |
| 101 | `notes.list` | notes | P | yes | PASS_SYNTH_E2E | 22/20/0 | yes | yes |  |
| 102 | `followups.create` | followups | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 103 | `followups.update` | followups | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 104 | `followups.list` | followups | O | yes | PASS_SYNTH_E2E | 124/62/0 | yes | yes |  |
| 105 | `favorites.toggle` | favorites | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | yes |  |
| 106 | `favorites.list` | favorites | O | yes | PASS_SYNTH_E2E | 21/19/0 | yes | no |  |
| 107 | `snote.add` | snote | O | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 108 | `snote.list` | snote | O | yes | PASS_SYNTH_E2E | 9/9/0 | yes | no |  |
| 109 | `snote.cancel` | snote | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 110 | `alerts.refresh` | alerts | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 111 | `alerts.list` | alerts | O | yes | PASS_SYNTH_E2E | 9/6/1 | yes | no |  |
| 112 | `alerts.handle` | alerts | O | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 113 | `alerts.counts` | alerts | G | yes | PASS_SYNTH_E2E | 129/59/0 | yes | no |  |
| 114 | `forms.generalLink` | forms | N | yes | PASS_SYNTH_E2E | 3/2/0 | yes | no |  |
| 115 | `forms.createLink` | forms | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 116 | `forms.list` | forms | O | yes | PASS_SYNTH_E2E | 4/3/1 | yes | no |  |
| 117 | `forms.review` | forms | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 118 | `dash.home` | dash | G | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 119 | `dash.overview` | dash | O | yes | PASS_SYNTH_E2E | 8/2/0 | yes | no |  |
| 120 | `dash.groups` | dash | G | yes | PASS_SYNTH_E2E | 16/4/0 | yes | no |  |
| 121 | `dash.compareCourses` | dash | G | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 122 | `dash.trends` | dash | O | no | POLICY_BLOCKED | 0/0/0 | no | no | POLICY_BLOCKED / NOT_EXPOSED_BY_DESIGN: owner charter 2026-11-20 (docs/OWNER_CURRENT_CHARTER_2026-11-20.md) allows group-level analytics only — no per-soldier trends. Backend route preserved for an owner-approved disposition; no native screen calls it. |
| 123 | `dash.strengthsGaps` | dash | O | yes | PASS_SYNTH_E2E | 3/1/0 | yes | no |  |
| 124 | `analytics.insights` | analytics | G | yes | PASS_SYNTH_E2E | 130/60/0 | yes | no |  |
| 125 | `reports.build` | reports | O | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 126 | `reports.preview` | reports | G | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 127 | `reports.generate` | reports | O | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive export adapter |
| 128 | `reports.fullExport` | reports | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | adapter not connected in synthetic mode |
| 129 | `reports.download` | reports | O | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive export adapter |
| 130 | `reports.jobs` | reports | O | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 131 | `import.start` | import | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 132 | `import.preview` | import | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 133 | `import.decide` | import | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 134 | `import.commit` | import | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 135 | `import.cancel` | import | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 136 | `import.jobs` | import | A | yes | PASS_SYNTH_E2E | 1/0/0 | no | no |  |
| 137 | `docs.upload` | docs | P | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive file storage |
| 138 | `docs.list` | docs | P | yes | PASS_SYNTH_E2E | 1/0/0 | no | no |  |
| 139 | `docs.download` | docs | P | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive file storage |
| 140 | `docs.requestLink` | docs | P | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 141 | `docs.reviewLink` | docs | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 142 | `docs.pendingLinks` | docs | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 143 | `docs.attachEvidence` | docs | P | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 144 | `docs.evidence` | docs | P | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 145 | `ocr.start` | ocr | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs OCR/Drive adapter |
| 146 | `ocr.rows` | ocr | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 147 | `ocr.editRow` | ocr | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 148 | `ocr.approveRow` | ocr | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 149 | `ocr.rejectRow` | ocr | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 150 | `ai.ask` | ai | O | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 151 | `ai.draft` | ai | O | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 152 | `ai.drafts` | ai | O | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 153 | `ai.reviewDraft` | ai | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 154 | `backup.create` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0/0/0 | no | yes | needs Drive/Spreadsheet adapter |
| 155 | `backup.list` | backup | A | yes | PASS_SYNTH_E2E | 3/3/0 | yes | no |  |
| 156 | `backup.verify` | backup | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive adapter |
| 157 | `backup.plan` | backup | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 158 | `backup.restore` | backup | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive adapter |
| 159 | `backup.recover` | backup | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive adapter |
| 160 | `preflight.run` | preflight | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 161 | `preflight.last` | preflight | A | yes | PASS_SYNTH_E2E | 3/3/0 | yes | no |  |
| 162 | `backup.prune` | backup | A | no | BLOCKED_NOT_CONNECTED | 0/0/0 | no | no | needs Drive adapter |
| 163 | `migration.run` | migration | A | no | NOT_IMPLEMENTED | 0/0/0 | no | no |  |
| 164 | `meetings.list` | meetings | N | yes | PASS_SYNTH_E2E | 6/3/2 | yes | no |  |
| 165 | `meetings.get` | meetings | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 166 | `meetings.options` | meetings | N | yes | PASS_SYNTH_E2E | 2/1/0 | yes | no |  |
| 167 | `meetings.save` | meetings | A | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 168 | `tasks.list` | tasks | N | yes | PASS_SYNTH_E2E | 8/8/1 | yes | no |  |
| 169 | `tasks.get` | tasks | N | yes | PASS_SYNTH_E2E | 2/2/0 | yes | no |  |
| 170 | `tasks.setStatus` | tasks | N | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 171 | `tasks.indicators` | tasks | G | yes | PASS_SYNTH_E2E | 129/59/0 | yes | no |  |
| 172 | `meetings.integrity` | meetings | N | yes | PASS_SYNTH_E2E | 9/4/1 | yes | no |  |
| 173 | `meetings.auditRepair` | meetings | A | yes | PASS_SYNTH_E2E | 1/1/0 | yes | no |  |
| 174 | `audit.list` | audit | A | yes | PASS_SYNTH_E2E | 1/1/4 | yes | yes |  |
