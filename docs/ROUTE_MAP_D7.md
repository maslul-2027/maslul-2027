# ROUTE_MAP_D7 — explicit classification of all 173 API routes

Source of truth: `tests/route_classes.json` (enforced by test D7-ROUTE-MAP: exactly the routes of `API_`, none missing, none stale).

- **G** = GROUP — aggregate only, no soldier name/id/personal number in any response (admin or commander)
- **O** = OPERATIONAL individual — admin: all courses; commander: own courseScope and only the soldiers visible to him
- **P** = PERSONAL restricted — individual sensitive data (private details, emergency contact, documents, private assessments); Policy actions decide, scope + visibility enforced
- **A** = ADMIN ONLY — management / system; every commander refused (verified by D7-SWEEP-OPERATIONAL)
- **N** = NO SOLDIER DATA — configuration / metadata / organization; verified to carry no soldier identity (D7-SWEEP-GROUP)

| Route | Class | Verified by |
|---|---|---|
| `acttypes.create` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `acttypes.list` | N | D7-SWEEP-GROUP |
| `acttypes.rename` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `acttypes.setActive` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `ai.ask` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `ai.draft` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `ai.drafts` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `ai.reviewDraft` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `alerts.counts` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `alerts.handle` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `alerts.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `alerts.refresh` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `analytics.insights` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `assess.add` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `assess.list` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `assignments.create` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `assignments.list` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `assignments.mine` | N | D7-SWEEP-GROUP |
| `assignments.setActive` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `assignments.update` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `attendance.create` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `attendance.events` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `attendance.roll` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `attendance.summary` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `audit.list` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `backup.create` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `backup.list` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `backup.plan` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `backup.prune` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `backup.recover` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `backup.restore` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `backup.verify` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `correction.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `correction.request` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `correction.review` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `courses.archive` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `courses.create` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `courses.list` | N | D7-SWEEP-GROUP |
| `courses.org` | N | D7-SWEEP-GROUP |
| `courses.rename` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `courses.reopen` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `dash.compareCourses` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `dash.groups` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `dash.home` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `dash.overview` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest + D7-MATRIX/SPOOF/SOLDIER-ID/LEAK-F6 |
| `dash.strengthsGaps` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `dash.trends` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `docs.attachEvidence` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `docs.download` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `docs.evidence` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `docs.list` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `docs.pendingLinks` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `docs.requestLink` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `docs.reviewLink` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `docs.upload` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `emergency.get` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `emergency.set` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `emergency.orphans` | A | R5.2.1 orphan reconciliation; preview / explicit cleanup; admin-only, metadata only, audited |
| `events.create` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `events.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `exams.attempt` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `exams.attempts` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `exams.defCreate` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `exams.defPass` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `exams.defs` | N | D7-SWEEP-GROUP |
| `exams.meetings` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `exams.summary` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest + D7-MATRIX/SPOOF/SOLDIER-ID/LEAK-F6 |
| `favorites.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `favorites.toggle` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `fitness.addTable` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.approve` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.completion` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest + D7-MATRIX/SPOOF/SOLDIER-ID/LEAK-F6 |
| `fitness.create` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `fitness.draftSource` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.editRow` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.importDraft` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `fitness.quality` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest + D7-MATRIX/SPOOF/SOLDIER-ID/LEAK-F6 |
| `fitness.recompute` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.summary` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `fitness.typeActive` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.typeCreate` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.typeVariant` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `fitness.typeWeights` | N | D7-SWEEP-GROUP |
| `fitness.types` | N | D7-SWEEP-GROUP |
| `fitness.versions` | N | D7-SWEEP-GROUP |
| `followups.create` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `followups.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `followups.update` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `forms.createLink` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `forms.generalLink` | N | D7-SWEEP-GROUP |
| `forms.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `forms.review` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `import.cancel` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `import.commit` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `import.decide` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `import.jobs` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `import.preview` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `import.start` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `marches.create` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `marches.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `marches.summary` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `meetings.auditRepair` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `meetings.get` | N | D7-SWEEP-GROUP |
| `meetings.integrity` | N | D7-SWEEP-GROUP |
| `meetings.list` | N | D7-SWEEP-GROUP |
| `meetings.options` | N | D7-SWEEP-GROUP |
| `meetings.save` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `migration.run` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `mk.create` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `mk.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `mk.summary` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `nav.create` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `nav.groups` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest + D7-MATRIX/SPOOF/SOLDIER-ID/LEAK-F6 |
| `nav.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `nav.summary` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `navtypes.create` | N | D7-SWEEP-GROUP |
| `navtypes.list` | N | D7-SWEEP-GROUP |
| `navtypes.rename` | N | D7-SWEEP-GROUP |
| `navtypes.setActive` | N | D7-SWEEP-GROUP |
| `notes.list` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `notes.save` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `ocr.approveRow` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `ocr.editRow` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `ocr.rejectRow` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `ocr.rows` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `ocr.start` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `preflight.last` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `preflight.run` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `qual.assignments` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `qual.define` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `qual.dueHistory` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `qual.list` | N | D7-SWEEP-GROUP |
| `qual.postpone` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `qual.requestExclusion` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `qual.reviewExclusion` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `qual.setActive` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `qual.summary` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `qual.update` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `readiness.assess` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `readiness.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `readiness.summary` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest + D7-MATRIX/SPOOF/SOLDIER-ID/LEAK-F6 |
| `record.cancel` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `record.edit` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `record.history` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `record.restore` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `reports.build` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `reports.download` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `reports.fullExport` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `reports.generate` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `reports.jobs` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `reports.preview` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `settings.list` | N | D7-SWEEP-GROUP |
| `settings.set` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `snote.add` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `snote.cancel` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `snote.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `soldiers.cancel` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `soldiers.card` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `soldiers.create` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `soldiers.list` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `soldiers.private` | P | D7-SWEEP-OPERATIONAL + v1_private / v1_pentest |
| `soldiers.reassign` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `soldiers.restore` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `soldiers.setActive` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `soldiers.update` | O | D7-SWEEP-OPERATIONAL (out-of-scope refused; in-scope commander sees only visible soldiers) + v1_pentest |
| `tasks.get` | N | D7-SWEEP-GROUP |
| `tasks.indicators` | G | D7-SWEEP-GROUP (recursive scan, admin + 4 commanders, 6 argument shapes) |
| `tasks.list` | N | D7-SWEEP-GROUP |
| `tasks.setStatus` | N | D7-SWEEP-GROUP |
| `users.add` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `users.list` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |
| `users.set` | A | D7-SWEEP-OPERATIONAL (every commander refused) + v1_pentest |

Notes: write routes of classes O/P/A are classified but not exercised with real payloads by the sweeps (they would mutate the fixture); their authorization is covered by v1_pentest (every route × every role × unknown / inactive / empty identity), the domain suites, and mutations M227–M234. `ai.ask/ai.draft/ai.drafts`, `settings.list`, `forms.generalLink` were first classified A and corrected by the sweep to O / N / N because commanders legitimately use them (scoped / configuration); no permission was changed.
