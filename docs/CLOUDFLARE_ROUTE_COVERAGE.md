# כיסוי נתיבים — Cloudflare Workers Free + D1 (נוצר אוטומטית: `node scripts/cf_route_survey.js --write`)

כל שורה = נתיב אחד מתוך 185 הנתיבים המסווגים ב-`backend_next/route_table.js`, מורץ **דרך ה-Worker האמיתי** כמנהל על הקורס הסינתטי (קלט כללי).
**שימו לב:** "דורש קלט" אינו "נבדק מקצה לקצה" — המנוע הוא אותו קוד שנבדק ב-77 סוויטות; בדיקות ה-Worker המלאות (`tests/cf_worker.js`) מכסות את התהליכים הקריטיים. CPU = זמן JS של ה-Worker במדידת Node (פרוקסי; ללא SQL), D1 = משפטים/שורות שנקראו לבקשה אחת.

| סיכום | מספר |
|---|---|
| IMPLEMENTED | 78 |
| IMPLEMENTED_NEEDS_INPUT | 97 |
| UNSUPPORTED | 4 |
| BLOCKED_BY_POLICY | 6 |
| DEFECT | 0 |

| נתיב | סוג | סיווג | תוצאה | CPU חציוני ms | משפטי D1 | שורות נקראו | טבלאות |
|---|---|---|---|---|---|---|---|
| `courses.list` | read | IMPLEMENTED | OK | 0.88 | 3 | 6 | Courses |
| `courses.org` | read | IMPLEMENTED | OK | 2.08 | 3 | 14 | Courses, Departments, Teams |
| `users.list` | read | IMPLEMENTED | OK | 0.36 | 3 | 4 |  |
| `soldiers.list` | read | IMPLEMENTED | OK | 0.85 | 3 | 75 | Courses, Departments, Teams, Soldiers |
| `soldiers.card` | read | IMPLEMENTED | OK | 4.39 | 3 | 18 | Soldiers, Courses, Departments, Teams, NavigationTests, NavigationTypes, Documents, AuditLog, FitnessTests, FitnessTestTypes, MarksmanshipTests, TheoreticalExamAttempts, ExamMeetings, ExamDefinitions, AttendanceEvents, AttendanceRecords, Marches, MarchAttendance, QualificationAssignments, Qualifications, ReadinessRecords, SoldierEvents, Alerts, ThresholdSettings |
| `soldiers.private` | read | IMPLEMENTED | OK | 0.74 | 3 | 75 | Courses, Soldiers, PrivateNotes, PersonalFollowUps, CommanderAssessments, Favorites, FollowUpHistory |
| `emergency.get` | read | IMPLEMENTED | OK | 0.7 | 6 | 68 | Courses, Soldiers, SoldierPersonalDetails |
| `emergency.orphans` | read | IMPLEMENTED | OK | 0.37 | 3 | 6 | Courses, SoldierPersonalDetails, SoldierUpdateRequests |
| `nav.list` | read | IMPLEMENTED | OK | 1.12 | 3 | 150 | Courses, NavigationTests, Soldiers, Departments, Teams, NavigationTypes |
| `navevents.list` | read | IMPLEMENTED | OK | 0.46 | 3 | 8 | Courses, NavigationEvents, NavigationTypes |
| `navevents.get` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.52 | 3 | 4 | NavigationEvents |
| `navevents.legacy` | read | IMPLEMENTED | OK | 0.73 | 3 | 81 | Courses, NavigationEvents, NavigationTypes, NavigationTests |
| `nav.groups` | read | IMPLEMENTED | OK | 2.73 | 3 | 150 | Courses, Soldiers, NavigationTests, Departments, Teams, NavigationTypes |
| `nav.summary` | read | IMPLEMENTED | OK | 0.45 | 3 | 8 | Courses, Soldiers, NavigationTests, NavigationTypes |
| `navtypes.list` | read | IMPLEMENTED | OK | 0.6 | 3 | 8 | Courses, NavigationTypes |
| `assignments.list` | read | IMPLEMENTED | OK | 0.46 | 3 | 16 | Courses, Departments, Teams, CommanderAssignments |
| `assignments.mine` | read | IMPLEMENTED | OK | 0.38 | 3 | 6 | Courses |
| `record.history` | read | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.35 | 3 | 4 |  |
| `correction.list` | read | IMPLEMENTED | OK | 0.39 | 3 | 6 | Courses, CorrectionRequests |
| `settings.list` | read | IMPLEMENTED | OK | 0.69 | 3 | 6 | Courses, ThresholdSettings |
| `fitness.types` | read | IMPLEMENTED | OK | 0.59 | 3 | 8 | Courses, FitnessTestTypes |
| `fitness.preview` | read | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.61 | 3 | 8 | Courses, FitnessTestTypes |
| `fitness.reference` | read | IMPLEMENTED | OK | 0.66 | 3 | 8 | Courses, FitnessScoringVersions, FitnessTestTypes |
| `fitness.draftSource` | read | IMPLEMENTED | OK | 0.46 | 3 | 4 |  |
| `fitness.versions` | read | IMPLEMENTED | OK | 0.4 | 3 | 6 | Courses, FitnessScoringVersions |
| `fitness.list` | read | IMPLEMENTED | OK | 1.53 | 3 | 134 | Courses, FitnessTests, Soldiers, FitnessTestTypes |
| `fitness.summary` | read | IMPLEMENTED | OK | 0.4 | 3 | 7 | Courses, Soldiers, FitnessTests |
| `fitness.completion` | read | IMPLEMENTED | OK | 1.97 | 3 | 142 | Courses, Departments, Teams, Soldiers, FitnessTestTypes, FitnessTests |
| `fitness.quality` | read | IMPLEMENTED | OK | 1.13 | 3 | 132 | Courses, FitnessScoringVersions, Soldiers, FitnessTests |
| `mk.list` | read | IMPLEMENTED | OK | 1.07 | 3 | 156 | Courses, MarksmanshipTests, Soldiers |
| `mk.summary` | read | IMPLEMENTED | OK | 0.38 | 3 | 7 | Courses, Soldiers, MarksmanshipTests |
| `exams.defs` | read | IMPLEMENTED | OK | 0.54 | 3 | 8 | Courses, ExamDefinitions, ThresholdSettings |
| `exams.attempts` | read | IMPLEMENTED | OK | 0.82 | 3 | 114 | ExamDefinitions, Courses, TheoreticalExamAttempts, Soldiers |
| `exams.meetings` | read | IMPLEMENTED | OK | 0.58 | 3 | 69 | ExamDefinitions, Courses, ExamMeetings, Soldiers |
| `exams.summary` | read | IMPLEMENTED | OK | 0.48 | 3 | 8 | Courses, Soldiers, TheoreticalExamAttempts, ExamMeetings, ExamDefinitions, ThresholdSettings |
| `acttypes.list` | read | IMPLEMENTED | OK | 0.51 | 3 | 8 | Courses, ActivityTypes |
| `attendance.events` | read | IMPLEMENTED | OK | 1.08 | 3 | 315 | Courses, ActivityTypes, Soldiers, AttendanceRecords, AttendanceEvents |
| `attendance.roll` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.57 | 3 | 11 | Courses, AttendanceEvents |
| `attendance.summary` | read | IMPLEMENTED | OK | 0.77 | 3 | 8 | Courses, Soldiers, AttendanceEvents, AttendanceRecords |
| `marches.list` | read | IMPLEMENTED | OK | 0.56 | 3 | 67 | Courses, Soldiers, MarchAttendance, Marches |
| `marches.summary` | read | IMPLEMENTED | OK | 0.4 | 3 | 6 | Courses, Soldiers, Marches, MarchAttendance |
| `readiness.list` | read | IMPLEMENTED | OK | 0.59 | 3 | 67 | Courses, ReadinessRecords, Soldiers |
| `readiness.summary` | read | IMPLEMENTED | OK | 0.42 | 3 | 6 | Courses, Soldiers, ReadinessRecords |
| `readiness.notEntered` | read | IMPLEMENTED | OK | 0.6 | 3 | 67 | Courses, Soldiers, ReadinessRecords |
| `events.list` | read | IMPLEMENTED | OK | 0.8 | 3 | 67 | Courses, SoldierEvents, Soldiers |
| `qual.list` | read | IMPLEMENTED | OK | 0.47 | 3 | 6 | Courses, Qualifications |
| `qual.dueHistory` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.38 | 3 | 4 | Qualifications |
| `qual.assignments` | read | IMPLEMENTED | OK | 0.54 | 3 | 67 | Courses, Soldiers, Qualifications, QualificationAssignments |
| `qual.summary` | read | IMPLEMENTED | OK | 0.45 | 3 | 6 | Courses, Qualifications, Soldiers, QualificationAssignments |
| `assess.list` | read | IMPLEMENTED | OK | 0.56 | 3 | 67 | Courses, Soldiers, CommanderAssessments |
| `notes.list` | read | IMPLEMENTED | OK | 0.34 | 3 | 6 | Courses, PrivateNotes |
| `followups.list` | read | IMPLEMENTED | OK | 0.54 | 3 | 75 | Courses, Soldiers, PersonalFollowUps, FollowUpHistory |
| `favorites.list` | read | IMPLEMENTED | OK | 0.56 | 3 | 67 | Courses, Soldiers, Favorites |
| `snote.list` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.36 | 3 | 4 |  |
| `alerts.list` | read | IMPLEMENTED | OK | 0.52 | 3 | 67 | Courses, Soldiers, Alerts |
| `alerts.counts` | read | IMPLEMENTED | OK | 0.34 | 3 | 6 | Courses, Soldiers, Alerts |
| `forms.generalLink` | read | IMPLEMENTED | OK | 0.39 | 3 | 6 | Courses |
| `forms.list` | read | IMPLEMENTED | OK | 0.53 | 3 | 67 | Courses, Soldiers, SoldierUpdateRequests |
| `dash.home` | read | IMPLEMENTED | OK | 1.77 | 3 | 14 | Courses, Soldiers, FitnessTests, MarksmanshipTests, NavigationTests, TheoreticalExamAttempts, ExamMeetings, AttendanceEvents, AttendanceRecords, Marches, MarchAttendance, Qualifications, QualificationAssignments, ReadinessRecords, Alerts, ThresholdSettings, NavigationTypes, ExamDefinitions |
| `dash.overview` | read | IMPLEMENTED | OK | 0.46 | 3 | 14 | Courses, Soldiers, FitnessTests, MarksmanshipTests, NavigationTests, TheoreticalExamAttempts, ExamMeetings, AttendanceEvents, AttendanceRecords, Marches, MarchAttendance, Qualifications, QualificationAssignments, ReadinessRecords, Alerts, ThresholdSettings, NavigationTypes, ExamDefinitions |
| `dash.groups` | read | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.53 | 5 | 9 | Courses |
| `dash.compareCourses` | read | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.48 | 5 | 7 |  |
| `dash.strengthsGaps` | read | IMPLEMENTED | OK | 0.36 | 3 | 5 | Courses, ThresholdSettings |
| `analytics.insights` | read | IMPLEMENTED | OK | 0.56 | 3 | 14 | Courses, Soldiers, FitnessTests, NavigationTests, MarksmanshipTests, TheoreticalExamAttempts, AttendanceEvents, AttendanceRecords, Departments, Teams |
| `reports.preview` | read | IMPLEMENTED | OK | 0.77 | 3 | 14 | Courses, Soldiers, Departments, Teams, FitnessTests, NavigationTests, MarksmanshipTests, TheoreticalExamAttempts, AttendanceEvents, AttendanceRecords, Marches, MarchAttendance |
| `reports.download` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.38 | 3 | 4 | ReportJobs |
| `reports.jobs` | read | IMPLEMENTED | OK | 0.36 | 3 | 6 | Courses, ReportJobs |
| `import.preview` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.49 | 3 | 4 | ImportJobs |
| `import.jobs` | read | IMPLEMENTED | OK | 0.36 | 3 | 6 | Courses, ImportJobs |
| `docs.list` | read | IMPLEMENTED | OK | 0.52 | 3 | 67 | Courses, Soldiers, Documents |
| `docs.download` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.36 | 3 | 4 | Documents |
| `docs.pendingLinks` | read | IMPLEMENTED | OK | 0.47 | 3 | 6 | Courses, Documents |
| `docs.evidence` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.49 | 3 | 4 | QualificationAssignments |
| `ocr.rows` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.45 | 3 | 4 | OCRJobs |
| `ai.ask` | read | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.44 | 3 | 6 | Courses |
| `backup.list` | read | IMPLEMENTED | OK | 0.52 | 3 | 4 | BackupJobs |
| `backup.verify` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.38 | 3 | 4 | BackupJobs |
| `backup.plan` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.4 | 3 | 4 | BackupJobs |
| `preflight.last` | read | IMPLEMENTED | OK | 1.14 | 3 | 356 | AuditLog |
| `meetings.list` | read | IMPLEMENTED | OK | 0.47 | 3 | 14 | Courses, Teams, Departments, MeetingMinutes, MeetingTasks |
| `meetings.get` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.36 | 3 | 4 | MeetingMinutes |
| `meetings.options` | read | IMPLEMENTED | OK | 1.07 | 3 | 16 | Courses, Teams, Departments, MeetingMinutes, MeetingTasks, CommanderAssignments |
| `tasks.list` | read | IMPLEMENTED | OK | 0.61 | 3 | 14 | Courses, Teams, Departments, MeetingMinutes, MeetingTasks |
| `tasks.get` | read | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.33 | 3 | 4 | MeetingTasks |
| `tasks.indicators` | read | IMPLEMENTED | OK | 0.85 | 3 | 14 | Courses, Teams, Departments, MeetingMinutes, MeetingTasks |
| `meetings.integrity` | read | IMPLEMENTED | OK | 3.54 | 3 | 358 | Courses, AuditLog, MeetingMinutes |
| `audit.list` | read | IMPLEMENTED | OK | 3.5 | 3 | 356 | AuditLog |
| `courses.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 1.57 | 3 | 4 |  |
| `courses.archive` | write | IMPLEMENTED | OK | 0.96 | 6 | 7 | Courses |
| `courses.reopen` | write | IMPLEMENTED | OK | 0.66 | 6 | 7 | Courses |
| `courses.rename` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.55 | 3 | 6 | Courses |
| `users.add` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.49 | 3 | 4 |  |
| `users.set` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.64 | 3 | 4 |  |
| `emergency.set` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.73 | 3 | 67 | Courses, Soldiers |
| `soldiers.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.61 | 3 | 6 | Courses |
| `soldiers.update` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.52 | 3 | 4 |  |
| `soldiers.reassign` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.57 | 3 | 4 |  |
| `soldiers.setActive` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.49 | 3 | 4 |  |
| `soldiers.cancel` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.5 | 3 | 4 |  |
| `soldiers.restore` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.76 | 3 | 67 | Soldiers, Courses |
| `nav.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.53 | 3 | 6 | Courses |
| `navevents.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.51 | 5 | 9 | Courses |
| `navevents.update` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.71 | 5 | 7 | NavigationEvents |
| `navevents.setStatus` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 1.26 | 3 | 4 |  |
| `navevents.adopt` | write | IMPLEMENTED | OK | 1.14 | 7 | 89 | Courses, NavigationEvents, NavigationTypes, NavigationTests |
| `navtypes.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.83 | 3 | 6 | Courses |
| `navtypes.rename` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.63 | 3 | 6 | NavigationTypes |
| `navtypes.setActive` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.43 | 3 | 4 |  |
| `assignments.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.52 | 3 | 4 |  |
| `assignments.update` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.89 | 3 | 4 |  |
| `assignments.setActive` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.48 | 3 | 4 |  |
| `record.edit` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.5 | 3 | 4 |  |
| `record.cancel` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.38 | 3 | 4 |  |
| `record.restore` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.43 | 3 | 4 |  |
| `correction.request` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.41 | 3 | 4 |  |
| `correction.review` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.46 | 3 | 4 | CorrectionRequests |
| `settings.set` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.41 | 3 | 6 | Courses |
| `fitness.typeCreate` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.52 | 3 | 6 | Courses |
| `fitness.typeWeights` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.42 | 3 | 4 |  |
| `fitness.typeActive` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.39 | 3 | 4 |  |
| `fitness.typeVariant` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.38 | 3 | 4 |  |
| `fitness.importDraft` | write | IMPLEMENTED | OK | 3.29 | 6 | 7 | Courses, FitnessScoringVersions, FitnessScoringRows |
| `fitness.editRow` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.51 | 3 | 6 | FitnessScoringVersions |
| `fitness.addTable` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.51 | 3 | 6 | FitnessScoringVersions |
| `fitness.approve` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.47 | 3 | 6 | FitnessScoringVersions |
| `fitness.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.39 | 3 | 6 | Courses |
| `fitness.recompute` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.83 | 3 | 69 | FitnessTests |
| `mk.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.41 | 3 | 6 | Courses |
| `exams.defCreate` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.44 | 3 | 6 | Courses |
| `exams.defPass` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.49 | 3 | 6 | ExamDefinitions |
| `exams.attempt` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.39 | 3 | 6 | Courses |
| `acttypes.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.62 | 3 | 6 | Courses |
| `acttypes.rename` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.56 | 3 | 6 | ActivityTypes |
| `acttypes.setActive` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.52 | 3 | 4 |  |
| `attendance.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.61 | 3 | 6 | Courses |
| `marches.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.98 | 3 | 67 | Courses, Soldiers |
| `readiness.assess` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.71 | 3 | 6 | Courses |
| `events.create` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.78 | 3 | 6 | Courses |
| `qual.define` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.89 | 3 | 6 | Courses |
| `qual.setActive` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.49 | 3 | 4 | Qualifications |
| `qual.postpone` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.52 | 3 | 4 | Qualifications |
| `qual.update` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.47 | 3 | 4 | QualificationAssignments |
| `qual.requestExclusion` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.56 | 3 | 4 | QualificationAssignments |
| `qual.reviewExclusion` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.82 | 3 | 4 | QualificationAssignments |
| `assess.add` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 1.22 | 3 | 67 | Courses, Soldiers |
| `notes.save` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 1.49 | 3 | 6 | Courses |
| `followups.create` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 1.2 | 3 | 67 | Courses, Soldiers |
| `followups.update` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 3.65 | 3 | 8 | PersonalFollowUps |
| `favorites.toggle` | write | IMPLEMENTED | OK | 3.26 | 6 | 68 | Courses, Soldiers, Favorites |
| `snote.add` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.66 | 3 | 4 |  |
| `snote.cancel` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.63 | 3 | 4 | SharedResultNotes |
| `alerts.refresh` | write | IMPLEMENTED | OK | 1.21 | 3 | 71 | Courses, Soldiers, ExamMeetings, Qualifications, ThresholdSettings, ReadinessRecords, PersonalFollowUps, Alerts |
| `alerts.handle` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.93 | 3 | 4 | Alerts |
| `forms.createLink` | write | IMPLEMENTED | OK | 2.36 | 6 | 68 | Courses, Soldiers, FormTokens |
| `forms.review` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.58 | 3 | 4 | SoldierUpdateRequests |
| `reports.generate` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.64 | 3 | 6 | Courses |
| `reports.exportAuthorize` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.6 | 3 | 6 | Courses |
| `reports.exportComplete` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.65 | 3 | 6 | Courses |
| `reports.fullExport` | write | UNSUPPORTED | NOT_CONNECTED | 0.34 | 1 | 1 | Courses, Soldiers, Departments, Teams, FitnessTests, MarksmanshipTests, NavigationTests, TheoreticalExamAttempts, AttendanceEvents, AttendanceRecords, Marches, MarchAttendance, Qualifications, QualificationAssignments, ReadinessRecords, SoldierEvents, NavigationTypes, ExamDefinitions |
| `import.start` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.53 | 3 | 6 | Courses |
| `import.decide` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.54 | 3 | 4 | ImportJobs |
| `import.commit` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.47 | 3 | 4 | ImportJobs |
| `import.cancel` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.49 | 3 | 4 | ImportJobs |
| `docs.upload` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.72 | 3 | 6 | Courses |
| `docs.requestLink` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.59 | 3 | 4 | Documents |
| `docs.reviewLink` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.46 | 3 | 4 | Documents |
| `docs.attachEvidence` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.52 | 3 | 4 | QualificationAssignments |
| `ocr.start` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.54 | 3 | 6 | Courses |
| `ocr.editRow` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.6 | 3 | 4 | OCRExtractedRows |
| `ocr.approveRow` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.44 | 3 | 4 | OCRExtractedRows |
| `ocr.rejectRow` | write | IMPLEMENTED_NEEDS_INPUT | NOT_FOUND | 0.52 | 3 | 4 | OCRExtractedRows |
| `backup.create` | write | UNSUPPORTED | NOT_CONNECTED | 0.28 | 1 | 1 | SchemaMeta, Courses, Departments, Teams, Soldiers, CommanderAssignments, Favorites, FitnessTestTypes, FitnessScoringVersions, FitnessScoringRows, FitnessTests, MarksmanshipTests, NavigationTypes, NavigationTests, ExamDefinitions, TheoreticalExamAttempts, ExamMeetings, ActivityTypes, AttendanceEvents, AttendanceRecords, Marches, MarchAttendance, Qualifications, QualificationAssignments, QualificationEvidence, QualificationDueDateHistory, ReadinessRecords, ReadinessReviews, Documents, SharedResultNotes, SoldierEvents, Alerts, AssistantDrafts, CorrectionRequests, AuditLog, ThresholdSettings, OCRJobs, OCRExtractedRows, ReportJobs, BackupJobs, AlertHistory, SoldierUpdateRequests, FormTokens, ImportJobs, ImportRows, SoldierPersonalDetails, CommanderAssessments, PrivateNotes, MeetingMinutes, MeetingTasks, MeetingTaskEvents, PersonalFollowUps, FollowUpHistory |
| `backup.restore` | write | UNSUPPORTED | NOT_CONNECTED |  |  |  |  |
| `backup.recover` | write | UNSUPPORTED | NOT_CONNECTED |  |  |  |  |
| `preflight.run` | write | IMPLEMENTED | OK | 1.19 | 6 | 5 |  |
| `backup.prune` | write | IMPLEMENTED | OK | 0.62 | 3 | 4 | BackupJobs |
| `meetings.save` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.75 | 3 | 6 | Courses |
| `tasks.setStatus` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.59 | 3 | 4 |  |
| `meetings.auditRepair` | write | IMPLEMENTED_NEEDS_INPUT | VALIDATION | 0.49 | 3 | 6 | Courses |
| `dash.trends` | blocked | BLOCKED_BY_POLICY | POLICY_BLOCKED | 0.5 | 2 | 1 |  |
| `reports.build` | blocked | BLOCKED_BY_POLICY | POLICY_BLOCKED | 0.42 | 2 | 1 |  |
| `ai.draft` | blocked | BLOCKED_BY_POLICY | POLICY_BLOCKED | 0.33 | 2 | 1 |  |
| `ai.drafts` | blocked | BLOCKED_BY_POLICY | POLICY_BLOCKED | 0.34 | 2 | 1 |  |
| `ai.reviewDraft` | blocked | BLOCKED_BY_POLICY | POLICY_BLOCKED | 0.33 | 2 | 1 |  |
| `migration.run` | blocked | BLOCKED_BY_POLICY | POLICY_BLOCKED | 0.34 | 2 | 1 |  |
