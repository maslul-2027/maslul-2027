## R5.2.16.4.4 FINAL TEST CANDIDATE (2026-11-19; source + tests changed — closes the D2 rounds)
Owner decision D2 (MIN_GROUP = 5, distinct soldiers, sub-cohorts) applied to the REMAINING aggregate paths found by a cross-cutting audit of every API route. No new product rule, no scoring / permission / schema / OAuth / manifest change.
- `src/Readiness.gs`: `readiness.summary` is now a GROUP route only (cohort-gated counts, NO per-soldier element). New explicit operational route `readiness.notEntered` (ids only, same `result.read` scope) feeds the dashboard action queue. `src/Code.gs` registers it; `src/Index.html` calls it.
- `src/Alerts.gs`: `Alerts.counts` (alerts.counts / dash.overview / dash.home / assistant) — red and yellow must each be backed by 0 or >= 5 DISTINCT soldiers, else `{ open, red, yellow: null, suppressed: true, has_open }`. `Dashboard.home` totals skip suppressed cards; Assistant prints a generic sentence; Index.html KPI / home column render it.
- `src/Dashboard.gs`: `groups()` shows a group metric only when its with-a-value / without split is legal (5 of 6 hidden; 5 of 10, 10 of 10, 5 of 5 shown), results counts hidden with it, and complementary suppression across groups per metric and for attendance (attendance only when the course figure is visible). A group with NO data is not treated as a hidden figure. `home` totals gated.
- `src/Analytics.gs`: `monthly_` drops the WHOLE month point (n, mean, soldiers) when its split is illegal (closes the 5-vs-9 across-month inference); report `bars` eligibility and the `group_gap_fitness` insight require a legal within-department split; the fitness distribution insight no longer prints minimum / maximum (median + inter-quartile range only).
- `src/Attendance.gs`: `attendance.events` — the present / absent split and the early-exit split of one event are `null` + `counts_suppressed` when illegal; exact facts stay in the explicit operational roll `attendance.roll`.
- `src/Index.html`: dashboard KPIs for alerts / fitness gaps / readiness use gated figures; the to-do queue no longer prints counts; attendance event table and event detail render "מדוכא".
- Tests: new suite `tests/r5_final_closure.js` (13 tests: split matrix N = 5/6/9/10/20, per-count completeness s = 0..10, DIFFERENTIAL equality for hidden cohorts of 1..4 soldiers across marksmanship / navigation / fitness-scored / attendance / early exit / readiness with non-vacuous s = 0 controls, groups / bars / gap with a 7-soldier department, monthly_, 5-vs-9 trend, repeated soldiers, no min/max, readiness split, alerts, attendance.events, assistant). Adapted (assertions preserved or increased): `d7_authz`, `v1_pentest`, `uxqa_server` (also: a pre-existing flaky scan — a `generated_at` millisecond such as ".201Z" equal to a short synthetic personal number failed 1 run in ~40 — now ignores timestamps only; all other bytes still scanned), `v1_tracking`, `r5_privacy_subcohort`, `ui_pd1` (KPI expectations of 12 alerts and "3 / 14" approved a 2-soldier red cohort and a 3-of-14 split; now asserts suppression and keeps the exact scoped alert LIST check), `route_classes.json` (see `reconciliation/FINAL_TEST_CHANGE_AUDIT.md`).
- Route classes: `readiness.summary` -> G; `readiness.notEntered` -> O; `dash.trends`, `dash.strengthsGaps` -> O (explicit soldier).
- Mutations: M241-M255 added (M240 retargeted; M37's stale anchor — it matched 0 times since before REV3 — repaired to the current `validateForm` code; M254/M255 run `ui_pd1`). Exception register: `docs/PRIVACY_EXCEPTION_REGISTER.md`. Google TEST smoke + rollback plan: `docs/GOOGLE_TEST_SMOKE_AND_ROLLBACK_PLAN.md`.
- Google runtime and Windows runtime: NOT RUN. `test_only/TEST_ONLY_appsscript.MYSELF.json`, `src/appsscript.json` and `Config.gs` are byte-identical to REV3.

## R5.2.16.4.4 REV3 — privacy sub-cohort suppression (2026-11-19; source + tests changed)
Owner decision D2 (MIN_GROUP = 5) now also covers sub-cohorts INSIDE a larger scope. Rule: a binary split of N soldiers (have/missing, scored/unscored, present/absent, early-exit/none, active/inactive) is shown only if each side is 0 or >= 5 distinct soldiers; if either side is 1-4, BOTH counts are suppressed (never the complement) with `{ suppressed:true, reason }` and a generic reason that names neither the small side nor its size. Multi-way splits (readiness statuses, qualification states, exam outcomes) hide all parts unless every part is 0 or >= 5. No scoring rule, permission, threshold, schema, OAuth scope, network call or model changed.
- `src/Analytics.gs`: new helpers `splitOk_`, `catOk_`, `cohortReason_`, `distinct_`, `coverage_`, `presenceGroup_`, `scoreOk_` and group wrappers `groupFitness_/Marksmanship_/Navigation_/Exams_/Qualifications_/Attendance_/Marches_`; `insights()` coverage + attendance items, `reportData()` completeness / KPI `n` / attendance KPI / monthly points, bars `n`.
- `src/Dashboard.gs`: `completeness_` (with_data/missing and with_score/missing_score), overview domain figures via the gated wrappers, readiness block without a per-soldier list, `groups()` attendance and result counts.
- `src/Fitness.gs`, `Marksmanship.gs`, `Navigation.gs`, `Exams.gs`, `Attendance.gs` (attendance + marches), `Qualifications.gs`, `Readiness.gs`: the group routes (no `soldierId`) are cohort-gated; per-soldier calls are unchanged. `Navigation.groupSummary` gates `soldiers_with_results`, counts and per-type figures with complementary suppression (raw output byte-identical: helper fields are non-enumerable).
- `src/Assistant.gs`: group facts use the gated summaries; the active/inactive soldier count is a binary split too.
- `src/Reports.gs`, `src/Index.html`: render the suppressed state ("מדוכא מטעמי פרטיות") instead of numbers/`null`.
- Tests: new suite `tests/r5_privacy_subcohort.js` (14 tests: 9/1, 1/9, 9/1 attendance, early exits, 5/5, 10/0, admin vs commander scope, readiness/marches/qualifications/navigation groups, serialized-JSON + generated-HTML scans, per-soldier routes unchanged). Existing tests adapted deliberately because they asserted figures backed by 1-4 soldiers: `v1_tracking`, `v1_qual`, `v1_dashboard`, `v1_assistant`, `v104_audit`, `v105_missing`, `ui_smoke`, `src_identity` (ledger). Suite count 57 -> 58 (`run_all.js`, both clean-machine scripts, focused gate 97 -> 111).
- Explicit exceptions (unchanged, per-soldier operational data under the same `result.read` scope): `readiness.summary` per-soldier list, `fitness.completion` / `fitness.quality` gap lists, `attendance.events` and event roll, `alerts.counts` (each alert is individually listed by `alerts.list`). Observation for the owner (not changed): the fitness distribution insight prints the minimum and maximum of >= 5 soldiers.
- Mutations: M08 retargeted to the new completeness code; new M235–M240 (splitOk_ always true, attendance cohort check removed, `coverage_` never suppresses, insights coverage split ignored, group fitness with 1-4 scored soldiers, readiness counts with a 1-4 part). Total 146 -> 152 (`EXP_MUT` in both clean-machine scripts).
- `scripts/windows_preflight.ps1`: only the Usage comment names the new ZIP; script SHA-256 updated in the status matrix, install guide and OWNER_ACTIONS.
- Google runtime: NOT RUN. No clasp push, deploy, setup, migration, trigger or edit of the existing Google project. The personal-Gmail TEST stage keeps using `test_only/TEST_ONLY_appsscript.MYSELF.json` (unchanged).

## R5.2.16.4.4 REV2 — QA correction (2026-11-19; documentation/comment only)
- Status matrix: removed the stale ZIP identity (previous candidate's SHA prefix/size); final ZIP SHA-256 and size are stated only in the external delivery message.
- `scripts/windows_preflight.ps1`: only the Usage comment example changed (now names the current candidate ZIP); runtime behavior untouched. Script SHA-256 updated in the status matrix, install guide and both OWNER_ACTIONS. Standalone and embedded copies are byte-identical.

## R5.2.16.4.4 — documentation reconciliation + QA closure (2026-11-19; documentation/packaging only)
- One authoritative version (R5.2.16.4.4) across README, both OWNER_ACTIONS, status matrix, install/Windows/Google runbooks, rollback notes and document index; version lineage and archived 4.x status files classified in `docs/DOCUMENT_STATUS_INDEX.md`.
- Fixed wrong preflight-script SHA-256 in the install guide and status matrix (the documented values matched no file); install guide now names this ZIP.
- Status/evidence updated: independent QA (Node 22.16.0, no Chromium) vs. reconciliation run (exact Node v22.23.4, Chromium 153): strict 57/57 suites, 853/853 tests, 0 SKIP; clean-machine 15/15; focused 97/97; identity 4/4. package-lock still intentionally absent (BLOCKED_NETWORK). Windows 10 / Google TEST NOT_RUN; production NOT APPROVED.
- `src/`, `scripts/`, `tests/`, `package.json`, `.nvmrc`, `appsscript.json` byte-identical to the input candidate (only `tests/last_run.json`, a volatile run record, was replaced by the real run of this tree).

## R5.2.16.4.1 — Windows handoff reference reconciliation (2026-11-18)
- Corrected active Windows preflight and clean-install guide to target the exact R5.2.16.4 archive. No product or extraction logic changes.

## R5.2.16.2 — Windows preflight correction (2026-11-18)
- Enforce PowerShell 5.1+ by full version comparison; check native Node/npm version-command exit codes; update usage banner.
- Update installation guide and standalone script SHA. No product source/tests/scoring/permissions/Google changes. Windows runtime remains NOT_RUN.

# CHANGELOG

## R5.2.16.1 — Documentation Reconciliation (תיעוד בלבד)
יושרו מסמכי ההפעלה (`README.md`, שני קובצי `OWNER_ACTIONS.md`, `docs/GOOGLE_TEST_RUNBOOK_D7.md`, `docs/INSTALL_CLEAN_MACHINE.md`, `docs/WINDOWS10_RUNBOOK_D7.md`, `docs/INSTALL_ROLLBACK_uxqa1.md` ×2 ועוד) למטריצת סטטוס אחת: `docs/R5_2_16_STATUS_MATRIX.md`. הוסר ה-SHA הישן מהוראות ההתקנה (SHA של ZIP סופי מופיע רק בהודעת המסירה החיצונית). אפס שינוי ב-`src/`, `tests/`, `scripts/`, `package.json`, `.nvmrc`, `appsscript.json`. אינדקס מסמכים: `docs/DOCUMENT_STATUS_INDEX.md`. **לא מבצעית. Production readiness: NOT APPROVED.**

## R5.2.16 — UX + נגישות (`src/Index.html`, `src/FormPage.html` בלבד)
טאבים ב-ARIA, טפסים עם שדות חובה/שגיאות נגישות, טבלאות רספונסיביות עם כותרות נגישות ומיון בכפתור, מגירת ניווט מודאלית, ניגודיות AA, יעדי מגע 44px, סטטוס שאינו תלוי צבע; 18 בדיקות רגרסיה חדשות ב-`tests/ui_uxqa.js`. ללא שינוי בניקוד, הרשאות, פרטיות, GROUP ONLY, חירום, OCR. **לא מבצעית.** ראיות: דוחות החבילה (`reports/`).

## 1.0.6-b7b8-r3-product-dev6.2-uxqa1 (final) — נוכחות, איש קשר לחירום, דוח אנליטי A4 (ברירת מחדל), פרטיות קבוצות <5, פעילים בלבד (**לא מבצעית; לא נבדקה ב-Google**)
פירוט: `docs/CHANGELOG_BATCH.md`, החלטות: `docs/DECISIONS_RECORD_uxqa1.md`, ממצאים: `docs/AUDIT_FINDINGS_uxqa1.md`, בדיקות: `docs/QA_REPORT_BATCH.md`.

## 1.0.6-b7b8-r3-product-dev6.1 — תיקוני QA-01 (הרשאות סינון לפי מחלקה) ו-QA-02 (עקביות Audit/Save) (**לא מבצעית**)
בסיס: product-dev6 (לא שונה). `department_ids` וסינון מחלקה מוגבלים לסמכות המבקש (`FORBIDDEN` מחוץ לסמכות); אירוע הצלחה נכתב רק אחרי commit; כשל Audit אחרי commit = הצלחה + אזהרה `AUDIT_FAILED`; נוספו `meetings.integrity`/`meetings.auditRepair` (מנהל). 52 סוויטות / 695 בדיקות PASS. פירוט: `docs/pd61/`.

## 1.0.6-b7b8-r3-product-dev6 — מודול סיכומי ישיבות ומעקב משימות (**לא מבצעית**)
בסיס: product-dev5 (לא שונה). מודול חדש (שרת + 3 מסכים), SCHEMA 3, משימות נוצרות רק בתוך סיכום ישיבה, מפקד/מנהל בלבד, יומן ביקורת מלא, שמירה עקבית עם rollback. פירוט: `docs/pd6/`. 51 סוויטות / 678 בדיקות PASS. לא הורץ Google/Deploy/נתוני אמת.

## 1.0.6-b7b8-r3-product-dev4 — מניעת כפילויות בתוך אותו קובץ ייבוא תוצאות (**לא מבצעית**)
בסיס: product-dev3 (לא שונה). **באג:** שתי שורות זהות (אותו חייל/תאריך/סוג/ערכים) באותו קובץ ייבוא כש״ג — Preview: 2 `ok`; Commit: 2 נוצרו. **שורש:** בדיקת הכפילות בתצוגה מקדימה מושווית מול רשומות שכבר קיימות במסד; שורות אחרות של אותו קובץ עדיין לא נוצרו, ולכן לא נראו. **בדיקה בייבוא ניווט וקליעה:** אותה בעיה בדיוק הייתה קיימת (הוכח בבדיקות על dev3: נכשלו) — תוקנו באופן עקבי. **תיקון (`src/Import.gs`):** ב-`Import.start`, ליעדי כש״ג/ניווט/קליעה נבנה מפתח זהות לכל שורה `ok` (`Import.resultKey_`): כש״ג — חייל+סוג+תאריך+חמשת הרכיבים (באותה נורמליזציה של ההשוואה מול רשומות קיימות); ניווט/קליעה — כל השדות המוכנים. השורה הראשונה נשארת `ok`; השנייה והבאות — `duplicate` ("שורה זהה לשורה N בקובץ"), ו-Commit אינו יוצר אותן. שורות שגויות אינן רושמות זהות. **ללא שינוי:** מנגנון מניעת ה-double commit של Import Job; זיהוי כפילויות מול רשומות קיימות (כולל מבוטלות); מבחנים עיוניים (חסימה כ-error ב-Commit ללא יצירת כפילות — נבדק, לא שונה); ייבוא חיילים. `APP.VERSION` → `…-product-dev4`. נוספו `tests/v1_import_infile.js` (9 בדיקות) ו-M80–M88. לא שונו ניקוד/משקלים/ספים/הרשאות/החלטות מוצר.

## 1.0.6-b7b8-r3-product-dev3 — תיקון זיהוי כפילויות בייבוא כש״ג (**לא מבצעית**)
בסיס: product-dev2-docfix (לא שונה; ZIP `1cd034ae…7e52`). **באג:** ייבוא חוזר של אותן תוצאות כש״ג בקובץ חדש הוצג כ-`ok` ולא כ-`duplicate` ונוצרה רשומה נוספת. **שורש:** `Import.prepareRow_` השווה `Object.keys(data)` מול עמודות הרשומה, אך רכיבי הכש״ג (`pullups`, `parallel_bars`, `trap_bar`, `run150x2`, `run3km`) נשמרים בתוך `raw_values_json` ולא כעמודות — ההשוואה לא יכלה להתאים. **תיקון (`src/Import.gs` בלבד):** ליעד `fitness` ההשוואה נעשית על המבנה המנורמל והשמור: רשומה **פעילה** של אותו קורס/חייל/סוג מבחן/תאריך ובעלת אותם ערכי רכיבים בתוך `raw_values_json` (ריק = חסר; 8 = "8" = "8.0"). ניווט, קליעה ומבחנים עיוניים — ללא שינוי. מנגנון מניעת ההגשה הכפולה של אותו Import Job — ללא שינוי. `APP.VERSION` עודכן ל-`…-product-dev3` (וכן הבדיקה ב-`v1_system.js`). נוספו `tests/v1_import_dups.js` (7 בדיקות) ו-M72–M79. לא שונו ניקוד/משקלים/ספים/הרשאות/החלטות מוצר.

## 1.0.6-b7b8-r3-product-dev2-docfix — תיקון תיעודי בלבד (**לא מבצעית**)
בסיס: product-dev2. **שונו מסמכים בלבד; אין שינוי בקוד/בדיקות/החלטות/ניקוד/הרשאות.** נוספו הצהרות "מסמך היסטורי — PRODUCT_DECISIONS.md הוא המקור המחייב" ב-PRODUCT_REVIEW_product-dev1, DECISIONS_NEEDED, OPEN_ISSUES_AND_DECISIONS_b7b8-r3, OPEN_BLOCKERS; הוסרו מרשימת "החלטות שנדרשות" הפריטים D5 (מי רשאי לראות קישור טופס) ו-D6 (הפקת דוחות למנהל בלבד), שנוסחו בטעות כפתוחים. `APP.VERSION` נשאר `1.0.6-b7b8-r3-product-dev2` (אין שינוי קוד).

## 1.0.6-b7b8-r3-product-dev2 — תיקון בקשות תיקון, מעבר על מסך מצב קורס (**לא מבצעית**)
בסיס: product-dev1 (לא שונה). **בקשות תיקון:** בעת יצירת הבקשה נשמר snapshot של הערכים הקודמים (עמודה חדשה `before_json` בסוף `CorrectionRequests`, תואם לאחור דרך `ensureTable`); `correction.list` מחזיר `before`/`has_snapshot`/שם חייל; המנהל רואה טבלת "שדה בעברית | ערך קודם | ערך מבוקש" + סיבה, מבקש וזמן; בקשות ישנות מציגות "אין ערך קודם שמור" (לא undefined); הכל ב-textContent. **מצב קורס:** משימות המתייחסות לחיילים (כש״ג חסר, כשירות לא הוזנה, בקשות עדכון, בקשות תיקון, התראות דחופות) מציגות שמות חיילים כקיצורי דרך לכרטיס — מהנתונים שהשרת כבר מחזיר לפי הרשאות, ללא הרחבת הרשאות. ללא שינוי בניקוד/הרשאות/החלטות סגורות. סוויטות חדשות: `pd2_corrections` (Node), `ui_pd2` (דפדפן); מוטציות M60–M71. פירוט: `docs/TEST_REPORT_product-dev2.md`.

## 1.0.6-b7b8-r3-product-dev1 — שדרוג מוצר וחוויית משתמש (**לא מבצעית**)
בסיס: stg2. מסך "מצב קורס" (נחיתה, משימות פעילות, היקף מפקד), ניווט דו-שלבי, טבלאות עם מיון/סינון/ריק/טעינה/הגנת תשובות ישנות, בקשות טופס קריאות, השוואת קורסים שמישה, פאנל שחזור עם סיבה, ולידציה בטופס חייל, התאמת נייד. ללא שינוי בניקוד/הרשאות/מדיניות. 41 סוויטות / 549 בדיקות. פירוט: `docs/PRODUCT_REVIEW_product-dev1.md`, `docs/TEST_REPORT_product-dev1.md`. F-1, F-2, AT-D07 עדיין דורשים Google אמיתי.

## 1.0.6-b7b8-r3-stg2 — סגירת F-2 והקשחת סקריפט ההתקנה (**לא מבצעית**)
בסיס: r3-stg1 (לא שונה). **F-2:** `dailyJob` הייתה ניתנת להפעלה מהדפדפן (גיבוי, ריענון התראות, גיזום, Preflight בהקשר מערכת) → הוחלפה ב-`dailyJob_` (שם פרטי לפי תיעוד Google, ללא פרמטר/אירוע); `installDailyTrigger` יוצר טריגר עליה ומסיר טריגר ישן; חדש `runDailyJobNow()` (מנהל בלבד, נכשל סגור) להרצה ידנית; Preflight בודק את `dailyJob_`. **לא מאומת ב-Google** — כולל השאלה אם טריגר מתוזמן יכול להפעיל פונקציה פרטית (לא מתועד; AT-D07). **F-1:** נבדק מחדש; נוספו בדיקות זהויות דומות ובדיקה סטטית שמסווגת פונקציות גלובליות/פרטיות ואוכפת את הרשימה הסקורה. **`clean_machine_verify.sh`:** נתיבי `return/`/`work/` מוחלטים (תיקון באג כתיבת `STATUS.txt` אחרי `cd`), `PASS_WITH_UNVERIFIED_LOCK` (exit 3) במקום PASS כשה-lock נוצר בריצה, שמירת ה-lock ו-hash שלו, סט בדיקות לסקריפט (stubs). מסמכים: `GLOBAL_FUNCTIONS_REVIEW.md`, `SECURITY_REVIEW_STATIC.md`, `ACCEPTANCE_TEST_PLAN.md` (AT-D07), `TEST_REPORT_r3-stg2.md`, `CHANGES_r3-stg1_to_r3-stg2.md`. 40 סוויטות / 528 בדיקות, 58 מוטציות; תוכנית הקבלה: 43 תרחישים (נוסף AT-D07).

## 1.0.6-b7b8-r3-stg1 — עותק הכנה ל-Staging (**לא מבצעית**)
בסיס: r3 (לא שונה). **שינוי קוד אחד, ממצא אבטחה F-1:** `Auth.assertAdminCaller_` בארבע פונקציות ההתקנה/מיגרציה (`setupDatabase`, `createFirstCourse`, `installDailyTrigger`, `migrateToV1`) — נדרש שהמריץ הוא `ADMIN_EMAIL`. לא שונו: ניקוד, הרשאות ה-API, B7/B8. תיעוד: `PRODUCT_DECISIONS.md` (החלטות מחייבות), `STAGING_ENVIRONMENT.md`, `ACCEPTANCE_TEST_PLAN.md` (42 תרחישים), `GOOGLE_ACCOUNT_ACTIONS.md`, `SECURITY_REVIEW_STATIC.md`, `INSTALL_CLEAN_MACHINE.md` + `scripts/clean_machine_verify.sh`. בדיקות: 515 (+3 סוויטה `stg_setup_guard`), מוטציות 52 (+3). לא הורץ Google אמיתי; ההתקנה הנקייה לא בוצעה בפועל.

## 1.0.6-b7b8-r3 — ולידציה סמנטית של הגדרת מבחן, קישור כללי לטופס פרטים, קיצור לדוחות (**לא מבצעית**)
תוקן: `weights_json` פגום סמנטית כבר לא מגדיר רכיבים נדרשים (blocked). נוסף: קישור כללי לטופס פרטים אישיים (קריאה בלבד, מאפיין `PERSONAL_FORM_URL`, **לא מוגדר — נדרש קישור מהבעלים**), כפתור קיצור "הפקת דוחות" (הדוחות עצמם כבר היו קיימים). פירוט: `docs/CHANGES_v1.0.6-b7b8-r2_to_r3.md`, `docs/TEST_REPORT_v1.0.6-b7b8-r3.md` (512 בדיקות, מוטציות 49/49), `docs/OPEN_ISSUES_AND_DECISIONS_b7b8-r3.md`.

## 1.0.6-b7b8-r2 — תיקון ביקורת B7: רכיבים נדרשים לפי סוג המבחן (**לא מבצעית**)
`stateOf` החזירה na לרכיב שחסר ב-JSON גם כשסוג המבחן דורש אותו → חייל יכול היה להופיע "הושלם" עם נתון חסר. תוקן: רכיבים נדרשים מ-`weights_json` (גיבוי `components_json`); na רק לרכיב שהסוג אינו דורש; JSON חסר/פגום/סוג לא קיים → blocked, לעולם לא complete. פירוט: `docs/CHANGES_v1.0.6-b7b8_to_r2.md`, `docs/TEST_REPORT_v1.0.6-b7b8-r2.md` (491 בדיקות, מוטציות 43/43), `docs/OPEN_ISSUES_AND_DECISIONS_b7b8-r2.md`.

## 1.0.6-b7b8 — B7 מסך חסרים בכש״ג + B8 בדיקת mm:ss מקומית (**לא מבצעית**)
בסיס: עותק של v1.0.6 (לא שונתה). פירוט: `docs/CHANGES_v1.0.6_to_v1.0.6-b7b8.md`, הגדרות והחלטה פתוחה ("נפסלה"): `docs/B7_B8_DEFINITIONS.md`, בדיקות: `docs/TEST_REPORT_v1.0.6-b7b8.md` (35 סוויטות/479, מוטציות 38/38).

## 1.0.6 — החלטות ניקוד מחייבות במתח (**שערי קבלה פתוחים — לא מבצעית**)
בסיס: v1.0.5. `ct/` (v1.0.2), `ct_v1.0.3/`, `ct_v1.0.4/`, `ct_v1.0.5/` לא שונו (אומת ב-`diff -r`). פירוט: `docs/CHANGES_v1.0.5_to_v1.0.6.md`, תוצאות: `docs/TEST_REPORT_v1.0.6.md`.
- **מתח בנים:** בכל סוגי המבחנים אך ורק טבלת "אפוד אישי · 7 ק״ג" (קבוע בקוד: `Fitness.VEST_VARIANT`). "ללא משקל חיצוני" אינו מסלול ניקוד לבנים: בחירה נדחית (`typeSetVariant`, `addTable`, אישור גרסה), הטבלה אינה מיובאת (נשמרת כחומר מקור היסטורי מסומן `excluded`), הגדרות ישנות ב-`variants_json` מתעלמות. הטבלה מסתיימת ב-15; מעל — `out_of_range` ("נדרשת בדיקה"), בלי חיתוך ובלי מעבר לטבלה אחרת.
- **מתח בנות:** חזרה אחת = 40 (**החלטה מקצועית מאושרת**, לא ערך שהועתק מהמקור; השורה מסומנת `PROF_DECISION_N1`); אפס חזרות = אין ציון אוטומטי (בדיקה).
- **אין fallback שקט:** הוסר `variant_unset`; בלי טבלה מתאימה — `no_table`. הפרדה נשמרת בין חסר (`not_entered`), אפס (`out_of_range`) ומחוץ לטווח.
- **ממשק:** הוסרו בחירת סוג ביצוע מתח והאפשרות "ללא משקל חיצוני"; מוצג כלל קבוע "מתח בנים: אפוד אישי 7 ק״ג — קבוע".
- **מסמכים:** N1, N2, N5, N6, N7 הוכרעו; ארכיון U1–U8; ניסוח מקבילים; ניקוי Staging ממוקד (בלי ריקון אשפה כללית).
- **בדיקות:** סוויטה חדשה `v106_pullups` (11), בדיקות קיימות עודכנו לסמנטיקה החדשה (לא נמחקו/הוחלשו), 5 מוטציות חדשות (29 סה״כ).
**לא שונה:** שאר טבלאות הניקוד (מוקפאות מול v1.0.5 בבדיקה), משקלים, הרשאות, מדיניות נתונים. **לא נבדק:** Apps Script/Sheets/Drive/Workspace אמיתיים — נדרש STAGING ייעודי ואישור אבטחת מידע. **המערכת אינה מוכנה להפעלה מבצעית.**

## 1.0.5 — סגירת פערים, ביקורת עצמאית והקשחה (**שערי קבלה פתוחים — לא מבצעית**)
בסיס: v1.0.4. `ct/` (v1.0.2), `ct_v1.0.3/` ו-`ct_v1.0.4/` לא שונו (אומת). פירוט מלא: `docs/CHANGES_v1.0.4_to_v1.0.5.md`.
- **פער הבדיקות:** 343 (Node, 26 סוויטות) + 50 (דפדפן, 4 סוויטות) = 393. `--ui` בלי Playwright נכשל, ספירות נפרדות (Node unit/integration/hardening, דפדפן), סוויטה ללא בדיקות = כישלון, אימות מחבילה מחולצת נקייה.
- **חסר ≠ אפס:** נמצאה חולשה (בדיקות `!== ''` מפוזרות; רווחים/טקסט/`true` יכלו להיספר) ← `Calc.validNumber` מרכזי בכל הצרכנים; `completeness.with_score`. 23 בדיקות ייעודיות + 24 מוטציות (תוצאות ב-`TEST_REPORT_v1.0.5.md`).
- **כש״ג:** ממשל נבדק (טיוטה ניתנת לעריכה ולא בשימוש; גרסה מאושרת קבועה; אישור גרסה חדשה לא משנה ציונים קודמים; ביקורת; הרשאות API ישיר). דוח איכות נתונים: סיבות ורשימת תוצאות, הוכחה שהוא קריאה-בלבד. חסמים N1–N8 נבדקו מחדש (3 סגורים בראיה, 3 ממתינים לאישור סופי, 2 פתוחים).
- **ממשק:** 20 בדיקות דפדפן (390 ו-1280, ניווט מלא, RTL, מצבי חסר/שגיאה/מחוץ לטווח, כרטיס חייל, מנהל ומפקד).
**לא שונה:** כללי ניקוד/טבלאות/משקלים, הרשאות, מבנה נתונים, עיצוב, שאר המודולים. **לא נבדק:** Apps Script/Sheets/Drive אמיתיים; `npm install` מאפס עם רשת.

## 1.0.4 — ביקורת עצמאית והקשחה (**שערי קבלה פתוחים — לא מבצעית**)
בסיס: v1.0.3 (נשמרת ללא שינוי בחבילה). `ct/` (v1.0.2) לא שונה (אומת ב-`diff -r`).
**סביבת בדיקות:** `package.json` (Node 22, Playwright 1.63.0 נעוץ), `.nvmrc`, `scripts/setup_tests.sh`, `tests/env_check.js`; `run_all.js` מציג את הסביבה, ב-`--ui` ללא Playwright הסוויטות **נכשלות** (קודם: SKIP שנראה כמעט כהצלחה), `--strict` מכשיל גם SKIP, וכותב `tests/last_run.json`.
**כש״ג — ממשק מנהל (לפעולות קיימות, בלי שינוי כללי ניקוד):** טעינת טיוטה מהתמלול, אישור גרסה (סימון "אומת מול המקור" + נימוק; בלי זה נדחה), בחירת סוג ביצוע מתח לבנים, שורת מצב ("גרסת ניקוד פעילה: אין / שם" + סוג ביצוע), רשימת גרסאות עם עמודות נכונות (קודם עמודת "הערה" ריקה), placeholder `00:50` / `13:00` בשדות הזמן.
**כש״ג — דוח איכות נתונים (קריאה בלבד, `fitness.quality`):** תוצאות עם/בלי ציון, חיילים פעילים בלי מין (לא ניתנים לניקוד), תוצאות שחושבו בגרסה אחרת. לא משנה כלום.
**ביקורת ללא שינוי קוד ניקוד:** נבדקו 11 הטבלאות מול התמלול (בנים/בנות — בדיקות v103), בחירת טבלה לפי מין, וריאנט מתח, משקלים (רגיל 20/20/20/10/30, פתיחה 20/20/20/40), חסר≠0 בכל המסלולים (דשבורד, סיכום, טרנדים, דוחות — `tests/v104_audit.js`), הרשאות מנהל/מפקד ובידוד קורסים בפעולות כש״ג החדשות. לא נמצא מסלול שבו חסר הופך לאפס ולא מסלול שמשתמש בטבלת המין הלא נכון.
**רגרסיה:** v1.0.3→v1.0.4 שונו רק: `Config.gs` (מספר גרסה), `Code.gs` (נקודת קצה חדשה אחת `fitness.quality`), `Fitness.gs` (פונקציית `dataQuality` בלבד — קריאה בלבד), `Index.html` (מסך מנהל כש״ג, `placeholder` גנרי בשדות טקסט — תוספת בלבד), ובדיקות/סקריפטים/תיעוד. מ-v1.0.2→v1.0.3 (נבדק קודם): `Calc.gs` (הסרת נוסחת Trap Bar), `Reports.gs` (טקסט ייצוא כש״ג) ושאר מודול הכושר. כל שינוי מחוץ למודול הכושר מכוסה בבדיקה (הסרת Trap Bar: `run.js`; ייצוא: v104_audit B).
**נבדק:** `--ui --strict`: 30 סוויטות, **393** בדיקות, 0 כשלים, 0 דולגו (חדש: `v104_audit` 7, `ui_fitness` 10).
**לא שונה:** כללי ניקוד/טבלאות, הרשאות, הגדרות מקצועיות, מדיניות נתונים, N1–N8 (פתוחים), קליעה/ניווט/נוכחות/שאר המודולים, ההדמיה.
**לא נבדק:** Apps Script/Sheets/Drive אמיתיים; התקנת Playwright מאפס (הרשת חסומה כאן — הותקן מראש בסביבה; ראו `docs/TEST_ENVIRONMENT.md`).

## 1.0.3 — סגירת נוסחאות הניקוד של מבחן הכושר הגופני (**שערי קבלה פתוחים — לא מבצעית**)
גרסה נפרדת; `ct/` (v1.0.2) לא שונה. נוגע רק בכש״ג.
**שינויים:**
- **תמלול הטבלאות** משתי התמונות (בנים / בנות) — 11 טבלאות, 232 שורות, מגדר מפורש בכל טבלה (`src/FitnessDraft.gs`, נוצר מ-`scoring/transcribe_v103.py`; תמלול קריא: `docs/FITNESS_SCORING_TRANSCRIPTION_v1.0.3.md`). נבדק: רציפות מלאה (ללא פער/חפיפה) והצלבה מול התמלול הקודם מהמסמכים המקוריים — 6 מ-7 הטבלאות הניתנות להשוואה זהות; בנות-מתח נבדלת רק בשורת 40 (חזרה כפולה במקור, ראו N1).
- **Trap Bar לפי טבלה** (בנים 80 ק״ג / בנות 40 ק״ג): הנוסחה הישנה `100−10×(10−חזרות)` הוסרה (`Calc.trapBarScore`). היא סתרה את התמונות (9 חזרות = 95, לא 90; 7 = 80, לא 70 ...).
- **זמנים רק `mm:ss` כטקסט.** מספר חשוף (למשל 780 או 50) נדחה ב-VALIDATION — לא מפורש. שדות הזמן בממשק הפכו מ״שניות (מספר)״ ל״דקות:שניות״.
- **מין החייל חובה לבחירת טבלה** (`gender_missing`); אין שימוש בטבלה של המין האחר.
- **מחוץ לטווח** (חזרות מעל המקסימום / 0 חזרות / משקל שהוקלד כחזרות) → ללא ציון, "נדרשת בדיקה — ערך מחוץ לטווח הטבלה".
- **רכיב חסר** → "ממתין להשלמת נתונים" (קודם: "אין מספיק נתונים"); סיבה לכל רכיב בממשק (`component_status`).
- שם הרכיב "ריצת 150×2" → "ריצת הלוך־חזור 300 מ׳" (המזהה הפנימי `run150x2` נשמר כדי לא לשבור נתונים).
- `importDraft`: כבר אין מיפוי גיליון→מגדר (המגדר מפורש בטבלאות); `sheets` אופציונלי (`['M']`/`['F']`). `addTable` מאפשר גם Trap Bar.
**לא שונה:** משקלים (20/20/20/10/30; פתיחה 20/20/20/40), שיטת התצוגה/עיגול (`Util.display1`), זרימת DRAFT→אישור מנהל, שאר מודולי הכושר, קליעה/ניווט/נוכחות, עיצוב, הרשאות.
**שורש התקלה במקרה 09/11/2026** (שחזור בבדיקה 9 — מקרה לפי הקוד; לא נבדק מול הנתונים החיים): (1) אין גרסת טבלאות **מאושרת** → אף רכיב לא מקבל ציון; (2) לבנים שתי טבלאות מתח ואין סוג ביצוע מוגדר → מתח לא מקבל ציון (אין ניחוש); (3) הזנת זמן כמספר-שניות בממשק במקום mm:ss; (4) מקבילים — לא הייתה טבלה כלל ב-v1.0.2; (5) נוסחת Trap Bar שגויה. בלי ציון אחד לא נוצר ציון משוקלל (נכון). אחרי התיקון, עם גרסה מאושרת וסוג ביצוע: בנים/אפוד 90.8, בנים/ללא משקל 86.8, בנות 96.1.
**נדרש מהמשתמש לפני שימוש:** אישור ערכים N1–N8 (ראו התמלול), הרצת `fitness.importDraft` ← `fitness.approve` (עם אימות מול המקור) והגדרת סוג ביצוע מתח לבנים (`fitness.typeSetVariant`).
**גרסה:** `APP.VERSION='1.0.3'`. בדיקות: **376** (Node 336 + דפדפן 40), 0 כשלים, 0 SKIP עם `--ui`. חדש: `tests/v103_fitness.js` (11). **לא הורצה בדיקה ב-Apps Script אמיתי.**

## 1.0.2 — תיקון ממוקד: פורמט טקסט ב-`SheetsStore.replaceAll` (**שערי קבלה פתוחים — לא מבצעית**)
**הכשל:** `replaceAll` קבע את פורמט הטקסט של עמודה לפי השורה הראשונה בלבד (`plans[0][j].forceText`). אם התא הראשון ריק והבא אחריו `00123` / מספר טלפון עם אפסים / טקסט שמתחיל ב-`=` — העמודה לא הוגדרה כטקסט, ו-Sheets עלול היה להפוך אותם למספר/נוסחה (ואז האימות אחרי הכתיבה היה זורק `UNSAFE_WRITE` ומפיל את השחזור, או גרוע — לשמור ערך שונה).
**התיקון (`src/Store.gs`, `replaceAll` בלבד):** עמודה מוגדרת כטקסט לפני הכתיבה אם **לפחות** תא מתוכנן אחד בה דורש טקסט (סריקת כל השורות). מספרים/בוליאנים אמיתיים בעמודה כזו מוחזרים ל-General (בקטעים רציפים) ולכן נשארים מספרים. האימות אחרי כתיבה הורחב: מספר/בוליאני חייבים לחזור זהים בערך ובטיפוס (עד כה נבדקו רק מחרוזות ונוסחאות). Preflight, TOUCHED, סמן restoring, rollback, `backup.recover` — ללא שינוי.
**בדיקות חדשות:** `tests/v1_replaceall_text.js` (5): שורה ראשונה ריקה + `00123` / טלפון / `=…` / `+…` / `1E3` + מספרים ובוליאנים באותה עמודה; מיקום הערך הרגיש (ראשון/אחרון/אמצע); שחזור מלא ובדיקת הערכים *אחרי* השחזור (על הגיליון ודרך Db); כשלים (כתיבה חלקית, השחתה שקטה, כשל בפורמט, כשל בניקוי זנב) ← rollback מדויק; זיהוי שינוי ערך. מוטציה: החזרת "שורה ראשונה בלבד" ← 4 כשלים; הסרת אימות המספרים ← 2 כשלים.
**גרסה:** `APP.VERSION='1.0.2'`. בדיקות: **367** (Node 327 + דפדפן 40), 0 כשלים, 0 SKIP עם `--ui`. **לא הורצה בדיקה ב-Apps Script אמיתי.**

## 1.0.1 — תיקוני ביקורת עצמאית על v1.0.0 (**שערי קבלה פתוחים — לא מבצעית**)
**1. Restore (קריטי):** `Backup.restore` / `SheetsStore.replaceAll` תוכננו מחדש. הטבלה מסומנת TOUCHED *לפני* ההחלפה ולכן גם הטבלה שנכשלה נכללת ב-rollback; Preflight מלא לגיבוי ולגיליון החי לפני כל כתיבה; `replaceAll` כבר לא מוחק קודם (אימות+המרה ← כתיבה אחת ← קריאה חוזרת ואימות ← ניקוי זנב רק אחרי); כותרות ופורמטים נשמרים; סמן `restoring` בטבלת BackupJobs חוסם שחזור מקביל; `ROLLBACK_FAILED` מדווח במפורש עם הטבלאות ומזהה הגיבוי; נקודת API חדשה `backup.recover`; הרשאה ונעילה בשרת. ראו `docs/RESTORE_FIX.md`.
**2. בדיקות חדירה:** `tests/v1_pentest.js` 3→11 בדיקות, עם "עולם" בדיקות (`tests/world.js`) שבו מזהים אמיתיים ושיוכים אמיתיים (2 קורסים, 6 משתמשים, חיילים פעילים/לא פעילים/מבוטלים, מסמכים של מעלים שונים, הערות, דוחות, גיבוי). סריקה של כל נקודת API × כל מפקד × כל סוג מזהה אמיתי (>20,000 קריאות). `CMD_OK` נכתבה מחדש כרשימה מנומקת (כל ערך מול פעולת Policy/אפיון), נבדק שכל שם קיים ב-API, ונקודה שנפתחת למפקד ואינה ברשימה — נכשלת. לא הורחבה כדי לעבור.
**3. `run_all.js`:** PASS / FAIL / SKIP בנפרד; exit≠0 רק ב-FAIL (או ב-`--strict` גם ב-SKIP); סיכום סוויטות ובדיקות + סיבות דילוג; שורה מפורשת "NOT a complete pass" כשיש דילוג.
**4. Preflight הרשאות Drive:** מודול `Preflight.gs` + `preflight.run/last` + כרטיס UI + הרצה בגיבוי היומי. בודק שיתוף בפועל (גישה ציבורית/קישור/דומיין/עורכים ישירים) בגיליון הראשי, הפרטי, תיקיית מסמכים, גיבויים וקבצי הדוחות. לא מסוגל לבדוק ← NOT_VERIFIED/BLOCKED; אין שינוי הרשאות אוטומטי.
**ממצא נוסף שתועד:** ראו REVIEW_RESPONSE §ממצאים נוספים (ללא שינוי מדיניות).
**גרסה:** `APP.VERSION='1.0.1'`; 155 נקודות API; בדיקות: **362** (Node 322 + דפדפן 40), 0 כשלים, 0 SKIP בהרצת `--ui`. ראו `docs/TEST_REPORT_v1.0.1.md`. **לא הורצה בדיקה ב-Apps Script אמיתי.**

## 1.0.0 — גרסה מאוחדת מלאה (פיתוח; **שערי קבלה פתוחים — לא מבצעית**)
בסיס: v0.4.1. כל ההגנות הקודמות נשמרו (שיוך מפקדים, לא פעיל/מבוטל, בידוד קורסים, ארכיון נועל כתיבה, NOT_FOUND אחיד, אין מחיקה פיזית). סכמה 1→2, 46→51 טבלאות, 152 נקודות API.
**מודולי מעקב:** כש״ג (סוגי מבחן, גרסאות ניקוד DRAFT→מאומת→מאושר, מגדר ו-וריאנט מוזנים ע״י מנהל, ללא ציון בלי גרסה מאושרת); קליעה רגילה/יל״מ מופרדות (ללא ספירת פגיעות); ניווט (ללא משך); מבחנים עיוניים א׳/ב׳/ג׳ + שיחה/ועדה נדרשת אוטומטית; נוכחות (כולם נוכחים כברירת מחדל, סימון חסרים/יציאה מוקדמת); מסעות; הכשרות והסמכות (ללא דירוג/תפוגה; החרגות באישור, דחיית יעד עם היסטוריה); כשירות ומגבלות פעילות (ללא אבחנות); אירועים והישגים.
**כרטיס חייל מלא** (`Card.gs`): כל הלשוניות + ציר זמן + מגמות/חוזקות/פערים רק כשהנתונים/ספים תומכים; מידע פרטי של מ״פ בנקודה נפרדת (`soldiers.private`) ובלשונית נפרדת.
**תהליכים פיקודיים:** הערות פרטיות (גרסאות), מעקב אישי ומועדפים (עכשיו בגיליון הפרטי), הערכות מפקד (המחבר+מנהל), הערות משותפות, בקשות תיקון/ביטול/שחזור, טופס עדכון חייל (קוד חד־פעמי, SHA-256, שדות בטבלה לבנה) + אישור מ״פ, התראות וטיפול (עם היסטוריה).
**מסכים:** בית כלל-קורסי, השוואות וניתוח, ניהול קורסים/ארכיון/משתמשים, הגדרות וספים, 20 מסכי UI כולל מובייל, `FormPage.html`.
**דוחות ונתונים:** בונה דוחות, PDF, ייצוא Excel מלא (נטרול הזרקת נוסחאות), ייבוא עם מיפוי/תצוגה מקדימה/החלטה לכל שורה (ללא דריסה בלי אישור).
**מסמכים/OCR/AI:** ארכיון מסמכים עם הרשאות בשרת ובקבצים, ראיות להסמכה, OCR טיוטה בלבד עם אישור פרטני (ספק לא נבחר), עוזר תגובתי מבוסס כללים (עובדות≠הערכות, פרטי רק למנהל במפורש, טיוטה רשמית דורשת אישור מ״פ).
**תפעול:** גיבוי יומי (טריגר) + ידני + אימות checksum + שחזור נקודת זמן עם גיבוי אוטומטי ו-rollback + שמירת N; יומן פעילות; מיגרציה `migrateToV1()` עם גיבוי ובדיקת אי-אובדן שורות; `installDailyTrigger()`.
**ממצאים שנמצאו בבדיקות אינטגרציה ותוקנו:** `Favorites` הועברה לגיליון פרטי; מיגרציה עם טבלאות ניהול; `setupDatabase` לא מקדמת סכמה בהתקנה קיימת; הרשאות OAuth; שגיאת תחביר ב-UI; flakiness בשעון הבדיקות.
**בדיקות:** 343 (Node 303 + דפדפן 40), 0 כשלים — ראו `docs/TEST_REPORT_v1.0.0.md`. **לא הורצה בדיקה ב-Apps Script אמיתי.**
**לא שונה / פתוח:** כש״ג DRAFT (U1–U8), פז״ם, חסם Workspace, וכל ההחלטות ב-`docs/DECISIONS_NEEDED.md`.

## 0.4.1 — תיקון ממוקד (ביקורת עצמאית על v0.4.0)
**תוקן (MEDIUM ×3)**
1. `Assignments.create`: סיבה חובה (מחרוזת לא ריקה; ריק/רווחים/לא-מחרוזת ← VALIDATION, בלי רשומה ובלי AuditLog) ונשמרת ב-`ASSIGNMENT_CREATE`. ה-UI קיבל שדה "סיבה" חובה.
2. `Navigation.groupSummary`: מסנני `departmentId`/`teamId` מוחלים בפועל (מצמצמים את חיילי ה-Snapshot ולכן כל נתון בדוח: קורס/מחלקות/צוותים/טבלת החיילים). ה-Snapshot מחיל קודם את תחום המפקד, ולכן מסנן רק מצמצם ולעולם לא מרחיב; מזהה מחוץ לתחום/לא קיים/מקורס זר/ערבוב מחלקה-צוות לא תואם ← דוח ריק, בלי רמז לקיום. ערך לא-סקלרי ← VALIDATION.
3. `Assignments.checkUser_(…, requireActive)`: יצירת שיוך והפעלה מחדש של שיוך דורשים משתמש **פעיל**. עריכת טווח וביטול נשארו כמות שהיו. משתמש שהושבת אחרי שקיבל שיוך: השורה נשארת (לא נמחקת ולא משתנה), אין לו גישה (`Auth.tryContext` ריק), מנהל יכול לבטל אותה, ואחרי הפעלת המשתמש אפשר להפעיל אותה מחדש.
**בדיקות:** `tests/stage3.js` 39→43 (+4: #1 api, #2 מנהל, #2 מפקד/עקיפה, #3). בדיקות קיימות עודכנו רק כך שהכנת השיוך מעבירה `reason`. שרת: 47+29+53+52+43 = **224**. דפדפן: 26/26 (בדיקת ה-UI של השיוך מוודאת גם דחייה ללא סיבה).
**מוטציות:** הסרת דרישת הסיבה — 2 נתפסות; הסרת שמירת הסיבה ביומן — 2; התעלמות מהמסננים — 3; הסרת בדיקת "פעיל" ביצירה (פעם בבדיקה המקדימה ופעם בתוך הנעילה) — נתפסת רק כששניהם מוסרים (2), כי הכפילות מכוונת; הסרת הבדיקה בהפעלה מחדש — 2.
**לא שונה:** ההחלטות הפתוחות (§ו ב-DECISIONS_NEEDED), כש״ג/U1–U8/פז״ם/Workspace. אין מודולים חדשים.

## 0.4.0 — שלב 3: שיוך מפקדים, כלל חייל מבוטל, מודול ניווט עובד
**חלק א׳ — CommanderAssignments** (`src/Assignments.gs`, טבלה חדשה, סה״כ 46 טבלאות)
- מנהל בלבד יוצר/עורך/מבטל/משחזר שיוך (קורס / מחלקה / צוות); סיבה חובה, `expected_updated_at`, ביקורת `ASSIGNMENT_CREATE/UPDATE/CANCEL/RESTORE` עם before/after. המפקד חייב להיות רשום בקורס; מנהל אינו משויך. חסום בקורס בארכיון.
- **התנהגות מוגדרת:** שיוך למחלקה = שני הצוותים שלה (וכל חייל שנוסף/הועבר אליה); שיוך לצוות = אותו צוות בלבד; שיוך לקורס = כל הקורס; מספר שיוכים פעילים = איחוד. **ללא שיוך פעיל — אפס חיילים** (נכשל-סגור). השיוך נקרא טרי בכל פעולה (ללא מטמון) ולכן ביטול/שינוי נכנס לתוקף מיד.
- מקור אמת יחיד `Soldiers.visibleFn_/isVisible_` משמש ל: רשימה, חיפוש, כרטיס, היסטוריה, `Records.list/load_/history/listCorrections`, הזנת תוצאה (גם בשחזור `request_id` בתוך הנעילה), `Snapshot`, ניווט ודוחות קבוצתיים. כל כשל נראות = NOT_FOUND אחיד.
- **שינוי התנהגות (מיגרציה):** מפקדים קיימים לא יראו חיילים עד שיוקצה להם שיוך. שכפול קורס אינו משכפל שיוכים.
**חלק ב׳ — חייל מבוטל** (`src/Snapshot.gs`)
- נתונים לא נמחקים ולא משתנים. מנהל רואה כרטיס והיסטוריה מלאה (כולל "הצג מבוטלים"). שער יחיד `Snapshot` (תמונת מצב) מחזיר רק חיילים לא מבוטלים ותוצאות לא מבוטלות; כל אגרגט עובר דרכו, ו-`Calc.mean` מותר רק ב-`Navigation.aggregate_` (בדיקה מבנית שנכשלת אם מישהו עוקף). היסטוריה ≠ תמונת מצב, והכרטיס מציג את שניהם.
**חלק ג׳ — ניווט** (`src/Navigation.gs`)
- `nav.list` (חייל/מחלקה/צוות/סוג/תאריכים/מבוטלות למנהל; שם המזין; `own`), `nav.groups` (קורס/מחלקות/צוותים + כיסוי לכל חייל, ללא דירוג), סוגי ניווט ניתנים להגדרה (`navtypes.*`, ביקורת). עריכה/ביטול/שחזור/בקשת תיקון — המנגנון הקיים. מפקד רואה שמות תצוגה של מזינים, לא דוא״ל.
**חלק ד׳ — ממשק** (`src/Index.html`): לשוניות חיילים / ניווט / שיוכי מפקדים (מנהל). מסך ניווט: הזנה עם חיווי שדות חסרים/לא תקינים, תמונת מצב נוכחית (עם הערה שמבוטלים מוחרגים וחיוג חיילים ללא תוצאה), רשימת תוצאות עם מסננים, פירוט והיסטוריה, עריכה/ביטול/שחזור (מנהל), בקשת תיקון (מפקד), בקשות תיקון ממתינות ופאנל סוגים (מנהל). הודעה ברורה למפקד ללא שיוך. DOM בלבד (ללא innerHTML מנתונים).
**בדיקות:** `tests/stage3.js` 39 (יחידה 9 / אינטגרציה 20 / הקשחה 10); סוויטות קיימות עודכנו (שיוכי מפקדים בהכנה). שרת: 47+29+53+52+39 = **220**. דפדפן: `ui_smoke.js` **26** (11 קודמות + 15 חדשות). מוטציות שלב 3: 9/10 נתפסו; ה-10 שורד כמוטנט שקול (הגנה כפולה בתוך הנעילה).
**לא שונה:** כש״ג (DRAFT), U1–U8, פז״ם, חסם Workspace. אין קליעה/כשירות/מבחנים/AI. אין נתוני אמת.

## 0.3.2 — תיקון ממוקד (ביקורת v0.3.1): דליפת תוצאה דרך idempotency
**תוקן (HIGH)**
- `Records.create`, מסלול `request_id` כפול: לפני החזרת הרשומה הקיימת נבדקת **בתוך הנעילה, על נתונים טריים** נראות החייל. מפקד + חייל לא פעיל/מבוטל ← VALIDATION עם אותה הודעה בדיוק (`Records.SOLDIER_UNAVAILABLE`) שמקבלת בקשה חדשה לחייל נסתר — כך ה-replay אינו ניתן להבחנה, ואין חשיפה של קיום הרשומה, הציון, המזהים או פרטי החייל. הודעת `Navigation.prepare` אוחדה לאותו קבוע.
- אותה מחלקת דליפה: replay של תוצאה ש**בוטלה** בידי מנהל אינו מחזיר אותה למפקד (VALIDATION "מזהה בקשה כבר בשימוש").
- נשמר: replay תקין לחייל פעיל ← `duplicate:true`; מנהל מקבל את ההתנהגות הקיימת גם כשהחייל לא פעיל.
**בדיקות:** `tests/soldiers.js` 42→52 (+2 יחידה, +5 אינטגרציה דרך `api()`, +3 הקשחה כולל race בתוך הנעילה והחלפת קורס). שרת: 47+29+53+52 = **181**. מוטציות (הסרת בדיקת הנראות / בדיקת התוצאה המבוטלת / כל השמירה) — נתפסות ב-3/1/4 בדיקות.
**לא שונה:** כל דרישה והחלטה אחרת; אין מודולים חדשים.

## 0.3.1 — תיקון ממוקד (ביקורת v0.3.0): חייל לא פעיל נחשף למפקד
**תוקן (HIGH)**
- `Soldiers.isVisible_` — מקור אמת יחיד: מפקד רואה רק חייל **לא מבוטל וגם פעיל** (`active` ריק/לא ברור = לא גלוי); מנהל רואה הכול.
- `Soldiers.list` ו-`Soldiers.card`/`load_`: חייל לא פעיל ← למפקד NOT_FOUND אחיד (אותו קוד והודעה כמו מזהה שלא קיים / קורס זר / מבוטל), גם בחיפוש, בסינון `active:false` ובקריאת API ישירה. מנהל ממשיך לראות ולנהל (עריכה, שינוי שיוך, הפעלה מחדש).
- מסלולים עוקפים שנסגרו: `nav.list`, `nav.summary`, `record.history`, `correction.request`, `correction.list` — תוצאות/בקשות של חייל נסתר אינן נחשפות למפקד (`Records.load_`/`list`/`listCorrections`). `Navigation.prepare`: הזנה לחייל לא קיים/זר/מבוטל/לא פעיל מחזירה הודעה אחידה אחת, בלי לחשוף סטטוס.
**בדיקות:** `tests/soldiers.js` 34→42 (+2 יחידה, +3 אינטגרציה, +3 הקשחה). כל הסוויטות: 47+29+53+42 = **171** בדיקות שרת. מוטציות: 6 הסרות של חלקי התיקון — כל אחת נתפסת (2–8 בדיקות נכשלות).
**לא שונה:** כל דרישה אחרת. אין מודולים חדשים. הצעות להחלטה (לא מומשו): `DECISIONS_NEEDED.md` §ה סעיפים 2 ו-6.

## 0.3.0 — שלב 2: מאגר חיילים וכרטיס חייל
**חדש**
- `src/Soldiers.gs`: יצירה, עריכה (סיבה חובה, before/after ביומן), רשימה עם חיפוש וסינון (שם/מספר אישי, מחלקה, צוות, פק״ל, פעילות), שינוי שיוך מחלקה/צוות, סטטוס פעילות, ביטול ושחזור רך, כרטיס חייל. כל ההרשאות בשרת (`Policy`): מנהל — הכול; מפקד — קריאה בלבד של חיילים פעילים בקורסיו, בלי שדות מנהל.
- כפילות: מספר אישי ייחודי בקורס (כולל מבוטלים). שיוך: רק למחלקות/צוותים קיימים באותו קורס; אין יצירת מחלקות/צוותים.
- עדכונים מקבילים: `expected_updated_at` חובה; ערך ישן ← `CONFLICT`. `updated_at` עולה בהכרח (גם באותה אלפית שנייה). הרשאה, סטטוס קורס וטריות נבדקים מחדש בתוך הנעילה.
- `src/Index.html`: מסך חיילים (רשימה, חיפוש, סינון, כרטיס, טופס הוספה/עריכה, שינוי שיוך, ביטול/שחזור), מותאם לנייד; רינדור ב-DOM בלבד (הגנת XSS). הזנת ניווט בוחרת חייל מהמאגר.
- `Code.gs`: `soldiers.list/card/create/update/reassign/setActive/cancel/restore` ברשימה הלבנה.
- `Policy.gs`: `soldier.cancel/restore/activity` (מנהל בלבד, חסום בקורס בארכיון).
- בדיקות: `tests/soldiers.js` (34), `tests/ui_smoke.js` (11, דפדפן אמיתי מול קוד השרת).
**שונה**
- `Config.gs`: עמודה `record_status` בטבלת `Soldiers` (לשימוש במנגנון הביטול הקיים). `Navigation.prepare` דוחה חייל מבוטל. `Util.todayIso()`.
**מה לא נבנה (בכוונה):** פז״ם (חסום), כשירות, מועדפים, טבלת פרטים אישיים (אין הגדרת שדות), העלאת/פתיחת מסמכים, ייבוא — הכרטיס לא מציג אותם. שאלות פתוחות: `docs/DECISIONS_NEEDED.md` §ה.
**לא שונה:** שכפול הרשאות, כש״ג DRAFT, U1–U8, פז״ם, חסם Workspace, ללא נתוני אמת.

## 0.2.3 — תיקוני ביקורת סבב 3 (ChatGPT), היקף צר
**תוקן**
- `Store.gs` — `updateById` אטומי: צילום ערך+פורמט של כל התאים לפני כתיבה, כתיבה ואימות של כולם; בכל כשל (אימות או חריגה באמצע) משוחזרים כל התאים ומאומת השחזור. אם גם השחזור נכשל — נזרק `ROLLBACK_FAILED` (חמור, עם מזהה הרשומה) ולא מוצג כאילו הנתונים הוחזרו. כך לא נוצר עדכון חלקי; ו-`updateById` לא חוזר בהצלחה, ולכן לא נכתב AuditLog של הצלחה.
- `Scoring.gs` — `lookup` (טבלת זמן): שניות חייבות להיות שלמות, סופיות ואי-שליליות, אחרת VALIDATION (650.5, שלילי, NaN, Infinity נדחים).
**בדיקות:** 129 (47 יחידה + 29 אינטגרציה + 53 הקשחה); מוטציות לשני התיקונים נתפסות.
**תיעוד:** `STAGING_TEST_PLAN.md` — S24 (עדכון רב-שדות שנכשל באמצע).
**לא שונה:** שכפול הרשאות (opt-in), טבלאות כש״ג DRAFT, U1–U8, פז״ם, חסם Workspace; הגנת Sheets עדיין לא אומתה (S23/S24).

## 0.2.2 — תיקוני ביקורת סבב 2 (ChatGPT), היקף צר
**תוקן**
- `Records.gs` — פרטיות: `listCorrections` מחזיר למפקד רק בקשות של רשומה פעילה (מנהל — הכול). `load_` מחזיר NOT_FOUND אחיד (אותה הודעה) למפקד על רשומה לא קיימת / מחוץ לתחום / מבוטלת, ולכן `requestCorrection` אינו חושף עוד RECORD_CANCELLED למפקד (מנהל עדיין מקבל הודעה מפורטת).
- `Scoring.gs` — `checkContiguity`: גבולות זמן חייבים להיות שלמים אי-שליליים (650.5/651.5 ושליליים נדחים). טבלאות הכש״ג לא שונו (נשארות DRAFT; רק U3 נכשלת כבעבר).
- `Store.gs` — מדיניות כתיבה: **כל** מחרוזת לא ריקה נכתבת כטקסט (לא רשימת תחיליות), ב-`insert` וב-`updateById`; אחרי כל כתיבה קריאה חוזרת (`getFormulas` + `getValues`) — אם נוצרה נוסחה או שהערך שונה: התאים מנוקים ונזרקת `UNSAFE_WRITE` (נכשל-סגור). **לא אומת ב-Apps Script אמיתי (S23).**
**בדיקות:** 123 (47 יחידה + 29 אינטגרציה + 47 הקשחה), מוטציות לשלושת התיקונים נתפסות.
**תיעוד:** `STAGING_TEST_PLAN.md` — S20–S23, ותוספות ל-S10/S12.
**לא שונה:** שכפול הרשאות (opt-in), טבלאות כש״ג DRAFT, U1–U8, פז״ם, חסם Workspace, אין נתוני אמת.

## 0.2.1 — תיקוני ביקורת (ChatGPT)
**תוקן** (פירוט מלא ב-`docs/REVIEW_RESPONSE.md`)
- `Records.gs`: `history` נחסם למפקד על רשומה מבוטלת; הרשאה וסטטוס קורס נבדקים מחדש **בתוך** הנעילה ב-`create`/`adminEdit`/`cancel`/`restore`/`requestCorrection`/`reviewCorrection`.
- `Courses.gs`: שכפול קורס אינו מעתיק הרשאות כברירת מחדל; `clone_permissions: true` מפורש בלבד (נרשם ביומן).
- `Calc.gs`: `weightedFitness` מאמת משקולות (סכום 100, סופיות, אי-שליליות) וציונים (0–100) ואינו מנרמל בשקט; `examEvaluate` מאמת `passScore`.
- `Scoring.gs`: `checkContiguity` מורחב (סדר, כפילות, טווח הפוך, חפיפה, פער, ערכים לא מספריים, קצוות פתוחים).
- `Store.gs`: כתיבה בטוחה — ערכים שמתחילים ב-`= + - @` נכתבים כטקסט, עמודות טקסט נכתבות כמחרוזת, והגיליון מורחב בכתיבה מעבר לגבול (באג חדש שנמצא).
**חדש:** `tests/hardening.js` (40 בדיקות), `docs/REVIEW_RESPONSE.md`, `docs/STAGING_TEST_PLAN.md`.
**לא שונה:** טבלאות כש״ג נשארו DRAFT; מנגנון הזיהוי; כל דרישה מאושרת.

## 0.2.0 — שלב 0 (ביקורת) + שלב 1 חלקי
**חדש**
- `src/Config.gs`: סכמה מלאה (45 טבלאות; 5 בגיליון פרטי נפרד).
- `src/Calc.gs`, `src/Scoring.gs`: חישובים טהורים ומנוע טבלאות (חסום עד אישור).
- `src/Policy.gs`, `src/AuthAudit.gs`: מטריצת הרשאות, הזדהות נכשלת-סגור, יומן ביקורת ללא תוכן פרטי.
- `src/Records.gs`: מחזור חיי רשומה (הזנה / תיקון / עריכת מנהל / ביטול / שחזור).
- `src/Courses.gs`: קורסים, ארגון 2×2, ארכוב/פתיחה, שכפול מבנה בלבד, משתמשים.
- `src/Navigation.gs`: מודול ניווט בצד שרת.
- `src/Setup.gs`, `src/Code.gs`, `src/Index.html`: התקנה, נקודת כניסה עם רשימה לבנה, מסך זמני.
- `scoring/`: תמלול טיוטה (187 שורות ב-7 טבלאות) + בדיקת רציפות.
- `tests/`: 72 בדיקות.

**שונה לעומת השלד 0.1.0** — ראה טבלת הממצאים ב-`docs/STAGE_REPORT.md` (12 ממצאים; הקריטי: `executeAs`).

**לא שונה:** אף דרישה מאושרת. נמצאו סתירה ופער במקור הכש״ג — הוצגו להחלטתך ולא יושמו.

## QA complement 2 (על dev6.1, ללא שינוי ב-src/)
- תאימות Windows 10: `scripts/clean_machine_verify.js` + `scripts/lib/zipnode.js` (ללא bash/zip/find); `tests/stg_clean_machine_script.js` מריצה את 7 התרחישים ב-Node בלבד; הסוויטה של ה-.sh נשמרה כ-`tests/stg_clean_machine_script_sh.js` (POSIX).
- `demo_data_audit.js`: החרגת OAuth scopes מדויקת (URL שלם השווה ל-manifest בלבד), נרמול נתיבים, 14 בדיקות שליליות.
- תוקנו קבועי הסקריפט הנקי (48/608/145/87 → 53/741/183/112). מוטציות M100–M114 (112/112 CAUGHT).
- ראו docs/qa_dev61_c2/.

### C2 r2 (סגירת פערי ראיות; ללא שינוי ב-src/, בבדיקות ובסקריפטים)
- ריצת מוטציות נקייה אחת: 112/112 CAUGHT, 0 ששרדו, exit=0 (docs/qa_dev61_c2/logs/mutations_full_clean.log). הריצה הקודמת (111/112, M109 שרדה בגלל שגיאת הגדרה) נשמרה כלוג היסטורי.
- עודכנו README.md ו-docs/INSTALL_CLEAN_MACHINE.md (נוהל והפרדה בין "הורץ" ל"לא הורץ"); הוסרו מספרי בדיקות וגרסאות ישנים.

### C2 r3 (תיעוד בלבד)
- תוקן סטטוס Windows: `npm run test:strict` על Windows 10 עבר לפי דיווח המשתמש (53/53, 741/741, 0 כשלים, 0 SKIP); ההרצות העצמאיות של `stg_clean_machine_script` ו-`demo_data_audit` והפעלת npm מתוך הסקריפט הנקי נשארות NOT RUN; `npm ci` BLOCKED_NETWORK. אין שינוי ב-src/, בבדיקות, בסקריפטים או בלוגים.

### C2 r3-rev2 (תיעוד בלבד)
- תועדה ההסרה המכוונת של `tests/last_run.json` (קובץ מצב זמני שנוצר ע"י `run_all.js`, ללא תלות בו; אינו נשלח ב-ZIP-ים של r2/r3/r3-rev2). ראו docs/qa_dev61_c2/CHANGES_C2.md. אין שינוי ב-src/, tests/ או scripts/.


### R5.1 — form submission failure hardening (2026-11-17)
- Prevent orphaned pending emergency-contact values after partial private-store writes or request-row insert failures.
- Add request-token idempotency and read-back handling for write-landed-then-threw conditions.
- Report post-commit Audit failure as a warning while preserving successful receipt.
- Added fault-injection coverage; see `docs/R5_1_FORM_SUBMISSION_FAILURE_HARDENING.md`.
- If token insertion may have landed but read-back is unavailable, attempt to revoke the uncertain credential and verify the revocation before returning a failure.


### R5.2.3 — orphan reconciliation classification (2026-11-18)
- Extended the admin-only emergency-contact orphan scan to distinguish truly unlinked orphan rows from linked-but-inconsistent staging groups.
- Existing requests are considered healthy only when they match the course and soldier, remain pending, carry the emergency marker, and have exactly one non-empty row for each approved contact field.
- Linked-but-inconsistent groups are reported as review-required metadata only and are never auto-cleared.
- Added regression coverage for a non-emergency request with stray pending data and an incomplete emergency request.
