# Google TEST — smoke-test plan, update path and rollback (PLAN ONLY — nothing here has been run)

**Hard gate:** nothing below is executed without explicit written approval of the project owner. No real soldier data, ever. This document performs no action.

## 1. Terms (do not mix them)
| Term | Meaning | In this stage |
|---|---|---|
| Code update | replace the script files (`src/*`, `appsscript.json`) of the SAME Apps Script project | the only change this candidate needs |
| Deployment update | point the EXISTING Web App Deployment at a new version (keeps the Web App URL) | after the code update, "Manage deployments → edit → new version" |
| Schema change | add / rename Sheets or columns | NONE in this candidate |
| Migration | `migration.run` (data transformation) | NOT needed, NOT to be run |
| Initial Setup | first-time creation of Sheets, settings, admin | NEVER on the existing TEST environment |

Do not: create a new Spreadsheet, a new Apps Script project or a new Deployment; change the Script ID; delete Sheets; re-run Setup; run Migration automatically.

## 2. Before the first Google step (owner)
1. Take a manual backup in the system (`backup.create`) and copy the Spreadsheet in Drive (File → Make a copy) — the code rollback below does not need them, but the data copy is the safety net.
2. Record the current deployment version number and keep a ZIP of the current code.
3. Confirm the manifest to be used: `test_only/TEST_ONLY_appsscript.MYSELF.json` (`webapp.access = MYSELF`). It must replace `appsscript.json` ONLY in the personal-Gmail TEST project; do not use the DOMAIN manifest there.

## 3. Smoke-test steps (synthetic data only)
1. Open the existing Web App URL as the owner; sign in; the dashboard loads without error.
2. Create a synthetic course section: 10 synthetic soldiers in two departments (5/5), names like "בדיקה 01".
3. Save one marksmanship result for 9 of them, one fitness result for 5 of them, one attendance event with 1 absent. Expect: dashboard / report / assistant show "מדוכא מטעמי פרטיות" for the 9/1 and 1/9 splits; 5/5 figures shown; `attendance.events` row shows suppressed present/absent.
4. Open the readiness screen: counts hidden for a 9/1 status split; the "soldiers without status" queue lists the one synthetic soldier.
5. Sign out and in again; every saved synthetic record is still there (persistence).
6. Permissions: sign in (or use the permission preview) as a limited user; confirm no access beyond scope.
7. `backup.create` then `backup.verify`; do NOT restore on the existing data.
8. Stop. Record results; do not continue to real data.

## 4. Rollback (code only, data untouched)
1. Apps Script editor → Deploy → Manage deployments → edit the SAME deployment → select the previous version → Deploy (Web App URL unchanged).
2. If the editor files were already replaced: paste back the saved previous ZIP's files (same names), save, and re-point the deployment to the previous version.
3. No Sheet is touched by a code rollback; no data is deleted; this candidate has no schema change, so older code reads the same Sheets.
4. If a synthetic test row was created, it is cancelled through the product's own cancel flow (never by deleting Sheet rows).
