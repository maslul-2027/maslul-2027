# 174-route evidence ledger (generated — do not edit)

Source: `scripts/build_route_ledger.js` from `src/Code.gs` API_ map, `tests/route_classes.json`, native sources and the calls recorded by the browser E2E (`E2E_CALLS_OUT`). Synthetic data only. **secured TEST E2E = NOT_RUN and deployed = NO for every row** (no secured backend exists yet).

**Summary:** {"total":174,"PASS_SYNTH_E2E":75,"IMPLEMENTED_NOT_E2E":8,"BLOCKED_NOT_CONNECTED":10,"NOT_IMPLEMENTED":81,"native_screen":81}

Markers: PASS_SYNTH_E2E = called successfully by the real UI/engine in a browser test · IMPLEMENTED_NOT_E2E = native screen exists, no browser evidence yet · BLOCKED_NOT_CONNECTED = needs an adapter that is not connected in synthetic mode (visible to the user, never faked) · NOT_IMPLEMENTED = no native workflow.

| # | Route | Group | Authz class | Native | Status | OK calls | Negative authz seen | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | `courses.list` | courses | N | yes | PASS_SYNTH_E2E | 26 | no |  |
| 2 | `courses.org` | courses | N | yes | PASS_SYNTH_E2E | 20 | no |  |
| 3 | `courses.create` | courses | A | yes | PASS_SYNTH_E2E | 2 | no |  |
| 4 | `courses.archive` | courses | A | yes | PASS_SYNTH_E2E | 1 | yes |  |
| 5 | `courses.reopen` | courses | A | yes | PASS_SYNTH_E2E | 1 | yes |  |
| 6 | `courses.rename` | courses | A | yes | PASS_SYNTH_E2E | 1 | yes |  |
| 7 | `users.list` | users | A | yes | PASS_SYNTH_E2E | 12 | yes |  |
| 8 | `users.add` | users | A | yes | PASS_SYNTH_E2E | 2 | yes |  |
| 9 | `users.set` | users | A | yes | PASS_SYNTH_E2E | 1 | yes |  |
| 10 | `soldiers.list` | soldiers | O | yes | PASS_SYNTH_E2E | 49 | yes |  |
| 11 | `soldiers.card` | soldiers | O | yes | PASS_SYNTH_E2E | 6 | no |  |
| 12 | `soldiers.private` | soldiers | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 13 | `emergency.get` | emergency | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 14 | `emergency.set` | emergency | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 15 | `emergency.orphans` | emergency | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 16 | `soldiers.create` | soldiers | O | yes | PASS_SYNTH_E2E | 1 | yes |  |
| 17 | `soldiers.update` | soldiers | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 18 | `soldiers.reassign` | soldiers | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 19 | `soldiers.setActive` | soldiers | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 20 | `soldiers.cancel` | soldiers | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 21 | `soldiers.restore` | soldiers | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 22 | `nav.create` | nav | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 23 | `nav.list` | nav | O | yes | PASS_SYNTH_E2E | 3 | no |  |
| 24 | `nav.groups` | nav | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 25 | `navtypes.list` | navtypes | N | yes | PASS_SYNTH_E2E | 6 | no |  |
| 26 | `navtypes.create` | navtypes | N | yes | PASS_SYNTH_E2E | 2 | no |  |
| 27 | `navtypes.rename` | navtypes | N | no | PASS_SYNTH_E2E | 1 | yes |  |
| 28 | `navtypes.setActive` | navtypes | N | no | PASS_SYNTH_E2E | 1 | no |  |
| 29 | `assignments.list` | assignments | A | yes | PASS_SYNTH_E2E | 18 | yes |  |
| 30 | `assignments.mine` | assignments | N | yes | PASS_SYNTH_E2E | 2 | yes |  |
| 31 | `assignments.create` | assignments | A | yes | PASS_SYNTH_E2E | 1 | yes |  |
| 32 | `assignments.update` | assignments | A | yes | PASS_SYNTH_E2E | 1 | yes |  |
| 33 | `assignments.setActive` | assignments | A | yes | PASS_SYNTH_E2E | 2 | yes |  |
| 34 | `nav.summary` | nav | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 35 | `record.edit` | record | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 36 | `record.cancel` | record | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 37 | `record.restore` | record | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 38 | `record.history` | record | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 39 | `correction.request` | correction | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 40 | `correction.list` | correction | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 41 | `correction.review` | correction | O | yes | IMPLEMENTED_NOT_E2E | 0 | no |  |
| 42 | `settings.list` | settings | N | yes | PASS_SYNTH_E2E | 2 | no |  |
| 43 | `settings.set` | settings | A | yes | PASS_SYNTH_E2E | 1 | yes |  |
| 44 | `fitness.types` | fitness | N | yes | PASS_SYNTH_E2E | 1 | no |  |
| 45 | `fitness.typeCreate` | fitness | A | no | NOT_IMPLEMENTED | 0 | yes |  |
| 46 | `fitness.typeWeights` | fitness | N | no | NOT_IMPLEMENTED | 0 | no |  |
| 47 | `fitness.typeActive` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 48 | `fitness.typeVariant` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 49 | `fitness.draftSource` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 50 | `fitness.versions` | fitness | N | no | NOT_IMPLEMENTED | 0 | no |  |
| 51 | `fitness.importDraft` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 52 | `fitness.editRow` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 53 | `fitness.addTable` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 54 | `fitness.approve` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 55 | `fitness.create` | fitness | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 56 | `fitness.list` | fitness | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 57 | `fitness.summary` | fitness | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 58 | `fitness.completion` | fitness | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 59 | `fitness.quality` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 60 | `fitness.recompute` | fitness | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 61 | `mk.create` | mk | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 62 | `mk.list` | mk | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 63 | `mk.summary` | mk | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 64 | `exams.defs` | exams | N | yes | PASS_SYNTH_E2E | 1 | no |  |
| 65 | `exams.defCreate` | exams | A | yes | PASS_SYNTH_E2E | 1 | no |  |
| 66 | `exams.defPass` | exams | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 67 | `exams.attempt` | exams | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 68 | `exams.attempts` | exams | O | yes | PASS_SYNTH_E2E | 2 | no |  |
| 69 | `exams.meetings` | exams | O | yes | PASS_SYNTH_E2E | 2 | no |  |
| 70 | `exams.summary` | exams | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 71 | `acttypes.list` | acttypes | N | yes | PASS_SYNTH_E2E | 7 | no |  |
| 72 | `acttypes.create` | acttypes | A | yes | PASS_SYNTH_E2E | 2 | no |  |
| 73 | `acttypes.rename` | acttypes | A | no | PASS_SYNTH_E2E | 1 | no |  |
| 74 | `acttypes.setActive` | acttypes | A | no | PASS_SYNTH_E2E | 1 | yes |  |
| 75 | `attendance.create` | attendance | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 76 | `attendance.events` | attendance | G | yes | PASS_SYNTH_E2E | 4 | no |  |
| 77 | `attendance.roll` | attendance | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 78 | `attendance.summary` | attendance | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 79 | `marches.create` | marches | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 80 | `marches.list` | marches | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 81 | `marches.summary` | marches | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 82 | `readiness.assess` | readiness | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 83 | `readiness.list` | readiness | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 84 | `readiness.summary` | readiness | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 85 | `readiness.notEntered` | readiness | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 86 | `events.create` | events | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 87 | `events.list` | events | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 88 | `qual.define` | qual | A | yes | PASS_SYNTH_E2E | 1 | no |  |
| 89 | `qual.list` | qual | N | yes | PASS_SYNTH_E2E | 1 | no |  |
| 90 | `qual.setActive` | qual | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 91 | `qual.postpone` | qual | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 92 | `qual.dueHistory` | qual | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 93 | `qual.assignments` | qual | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 94 | `qual.update` | qual | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 95 | `qual.requestExclusion` | qual | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 96 | `qual.reviewExclusion` | qual | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 97 | `qual.summary` | qual | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 98 | `assess.add` | assess | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 99 | `assess.list` | assess | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 100 | `notes.save` | notes | P | yes | PASS_SYNTH_E2E | 1 | no |  |
| 101 | `notes.list` | notes | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 102 | `followups.create` | followups | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 103 | `followups.update` | followups | O | yes | IMPLEMENTED_NOT_E2E | 0 | no |  |
| 104 | `followups.list` | followups | O | yes | PASS_SYNTH_E2E | 35 | yes |  |
| 105 | `favorites.toggle` | favorites | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 106 | `favorites.list` | favorites | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 107 | `snote.add` | snote | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 108 | `snote.list` | snote | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 109 | `snote.cancel` | snote | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 110 | `alerts.refresh` | alerts | A | yes | IMPLEMENTED_NOT_E2E | 0 | no |  |
| 111 | `alerts.list` | alerts | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 112 | `alerts.handle` | alerts | O | yes | IMPLEMENTED_NOT_E2E | 0 | no |  |
| 113 | `alerts.counts` | alerts | G | yes | PASS_SYNTH_E2E | 36 | no |  |
| 114 | `forms.generalLink` | forms | N | yes | PASS_SYNTH_E2E | 1 | no |  |
| 115 | `forms.createLink` | forms | A | yes | PASS_SYNTH_E2E | 1 | no |  |
| 116 | `forms.list` | forms | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 117 | `forms.review` | forms | A | yes | IMPLEMENTED_NOT_E2E | 0 | no |  |
| 118 | `dash.home` | dash | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 119 | `dash.overview` | dash | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 120 | `dash.groups` | dash | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 121 | `dash.compareCourses` | dash | G | no | NOT_IMPLEMENTED | 0 | no |  |
| 122 | `dash.trends` | dash | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 123 | `dash.strengthsGaps` | dash | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 124 | `analytics.insights` | analytics | G | yes | PASS_SYNTH_E2E | 37 | no |  |
| 125 | `reports.build` | reports | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 126 | `reports.preview` | reports | G | yes | PASS_SYNTH_E2E | 1 | no |  |
| 127 | `reports.generate` | reports | O | yes | BLOCKED_NOT_CONNECTED | 0 | no | needs Drive export adapter |
| 128 | `reports.fullExport` | reports | A | yes | IMPLEMENTED_NOT_E2E | 0 | yes |  |
| 129 | `reports.download` | reports | O | no | BLOCKED_NOT_CONNECTED | 0 | no | needs Drive export adapter |
| 130 | `reports.jobs` | reports | O | yes | PASS_SYNTH_E2E | 1 | no |  |
| 131 | `import.start` | import | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 132 | `import.preview` | import | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 133 | `import.decide` | import | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 134 | `import.commit` | import | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 135 | `import.cancel` | import | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 136 | `import.jobs` | import | A | yes | PASS_SYNTH_E2E | 1 | no |  |
| 137 | `docs.upload` | docs | P | no | BLOCKED_NOT_CONNECTED | 0 | no | needs Drive file storage |
| 138 | `docs.list` | docs | P | yes | PASS_SYNTH_E2E | 1 | no |  |
| 139 | `docs.download` | docs | P | no | BLOCKED_NOT_CONNECTED | 0 | no | needs Drive file storage |
| 140 | `docs.requestLink` | docs | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 141 | `docs.reviewLink` | docs | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 142 | `docs.pendingLinks` | docs | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 143 | `docs.attachEvidence` | docs | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 144 | `docs.evidence` | docs | P | no | NOT_IMPLEMENTED | 0 | no |  |
| 145 | `ocr.start` | ocr | A | no | BLOCKED_NOT_CONNECTED | 0 | no | needs OCR/Drive adapter |
| 146 | `ocr.rows` | ocr | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 147 | `ocr.editRow` | ocr | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 148 | `ocr.approveRow` | ocr | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 149 | `ocr.rejectRow` | ocr | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 150 | `ai.ask` | ai | O | yes | PASS_SYNTH_E2E | 2 | no |  |
| 151 | `ai.draft` | ai | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 152 | `ai.drafts` | ai | O | no | NOT_IMPLEMENTED | 0 | no |  |
| 153 | `ai.reviewDraft` | ai | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 154 | `backup.create` | backup | A | yes | BLOCKED_NOT_CONNECTED | 0 | yes | needs Drive/Spreadsheet adapter |
| 155 | `backup.list` | backup | A | yes | PASS_SYNTH_E2E | 1 | no |  |
| 156 | `backup.verify` | backup | A | no | BLOCKED_NOT_CONNECTED | 0 | no | needs Drive adapter |
| 157 | `backup.plan` | backup | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 158 | `backup.restore` | backup | A | no | BLOCKED_NOT_CONNECTED | 0 | no | needs Drive adapter |
| 159 | `backup.recover` | backup | A | no | BLOCKED_NOT_CONNECTED | 0 | no | needs Drive adapter |
| 160 | `preflight.run` | preflight | A | yes | IMPLEMENTED_NOT_E2E | 0 | no |  |
| 161 | `preflight.last` | preflight | A | yes | PASS_SYNTH_E2E | 1 | no |  |
| 162 | `backup.prune` | backup | A | no | BLOCKED_NOT_CONNECTED | 0 | no | needs Drive adapter |
| 163 | `migration.run` | migration | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 164 | `meetings.list` | meetings | N | yes | PASS_SYNTH_E2E | 1 | no |  |
| 165 | `meetings.get` | meetings | N | no | NOT_IMPLEMENTED | 0 | no |  |
| 166 | `meetings.options` | meetings | N | yes | PASS_SYNTH_E2E | 1 | no |  |
| 167 | `meetings.save` | meetings | A | yes | PASS_SYNTH_E2E | 1 | no |  |
| 168 | `tasks.list` | tasks | N | yes | PASS_SYNTH_E2E | 3 | no |  |
| 169 | `tasks.get` | tasks | N | no | NOT_IMPLEMENTED | 0 | no |  |
| 170 | `tasks.setStatus` | tasks | N | yes | IMPLEMENTED_NOT_E2E | 0 | no |  |
| 171 | `tasks.indicators` | tasks | G | yes | PASS_SYNTH_E2E | 36 | no |  |
| 172 | `meetings.integrity` | meetings | N | no | NOT_IMPLEMENTED | 0 | no |  |
| 173 | `meetings.auditRepair` | meetings | A | no | NOT_IMPLEMENTED | 0 | no |  |
| 174 | `audit.list` | audit | A | yes | PASS_SYNTH_E2E | 2 | yes |  |
