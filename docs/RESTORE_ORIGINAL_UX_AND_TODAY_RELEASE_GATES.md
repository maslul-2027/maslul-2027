# MASLUL 2027 — P0 restoration brief and real-use release gates
**Date:** 2026-11-20 (Asia/Jerusalem). **Owner instruction:** "Exactly the first design. Find a solution to make ALL approved functions work in that design. What blocks beginning to use it today?"

## 1. Nonnegotiable design authority — source of truth, not interpretation
The owner explicitly preferred the **original iPhone-first Pages mockup from PR #10**, not the recent legacy Apps Script look introduced by PR #36. Fetch EXACT original reference:
- **Original design commit:** `a2f70692d0b6fe112cdc38a3f03d2ca799e46e36` (merged PR #10)
- **Original design HTML:** `preview/index.html` at branch `feature/iphone-pwa-preview` (9847 bytes, exact CSS and elements)
- **Original initial UX specifics:** white/off-white canvas (`#f6f8f9`), compact MASLUL 2027 wordmark, teal `#007f83`, red `#c52d36` only restrained status, graphite `#15242b` hero with 23px radius, teal CTA `#04a6a4`, white 17px-radius cards, fine gray borders `#e6e9eb`, 3 compact KPI cards, 4 bottom tabs **בית / חניכים / מעקבים / עוד**, simple search and department chips, friendly contextual copy and single clear next action. Width max 820px, system font stack, 44px+ targets, modern RTL. Hero's original text "בוקר טוב 👋 / הכול ברור. אפשר להתקדם." is a visual reference; replace static claims/KPIs with real calculated, authorized data, not made-up metrics.
- **Comparison:** `main/preview/index.html` after PR #36 is a roughly 186K-char original Apps Script interface that currently fills the installed screen and looks like the rejected old app. **This is not visually acceptable.** PR #29 tried to restore the original home but left an iframe and 5 tabs; do not repeat that regression.
- Reference location: `https://github.com/maslul-2027/maslul-2027/blob/feature/iphone-pwa-preview/preview/index.html`
- Screenshot/visual tests: generate 320/360/390/414px screenshots of ORIGINAL and NEW. Conduct actual side-by-side visual diff and owner-facing artifact; retain original shell/spacing/color/visual hierarchy. Do not merely claim similar.

## 2. Technical solution: original shell as a host of real modules, not old shell with new paint
**Architectural rule:** KEEP first-design `<div class="app">` shell, original top bar, hero, cards, 4-item bottom nav and search pattern. DO NOT load the old HTML as a full-page app or via an `iframe`. DO NOT show the original `#side`, `#grps`, legacy header, endless generic forms or horizontal nested tab bars in the main UX. Instead:
1. Retain original UI shell components. Extract/rewrite each legacy screen domain as a **native screen within the original shell** under the same design tokens and layouts.
2. Keep original business/domain modules, dispatch routes, contracts, rules, role/permission enforcement in one shared data/logic layer. Do not reimplement scoring formulas from memory.
3. Use one authorized `appClient.api(method,args)` bridge whose implementation is either in-memory synthetic TEST for public Pages or an authenticated secure server for permitted private pilot. Clearly mark modes, **never** public network access to Apps Script/Sheets or real data.
4. On the installed app render original homepage and task-first navigation, source-backed widgets: KPI from server/engine, scoped roster and person card, actions, latest, favorites, course context, search. Use four bottom tabs EXACTLY **בית, חניכים, מעקבים, עוד**; navigation into other domains via contextual quick actions and categorized 'עוד' search. `עוד` is a native route/category view, not an open second app.
5. One shared app state and data source; remove the old 20-person mock roster, localStorage pretend attendance, parallel fake tasks and conflicting 4-person engine fixture. Use realistic synthetic fixtures (60/300/1000 for performance) consistent across every module. Do not display a constant 92% KPI.
6. Mobile cards for complex tabular data; logical multi-step forms grouped by purpose, responsive filter drawer, sticky contextual save/action, loading/empty/permission/error/success states, accessible labels/focus/touch feedback, top-of-screen context, breadcrumbs/back button. List ≠ dozens of raw API routes.
7. Each save shows success only after backend confirmation; use idempotency keys, duplicate-click guard, retry strategy, audit and course scoping. In public synthetic app, visibly label "הדגמה — נתונים מומצאים", with consistent reset semantics.
8. Build design system as components/shared CSS tokens and apply it to ALL functions, including `FormPage.html`. No extra app frame, inconsistent toolbar or new colors. Avoid CSS patch layering over old style as final solution. RTL, iPhone safe areas, PWA, offline behavior only where secure and well-defined.

## 3. Complete approved functionality — zero silent omissions
Canonical source is `docs/capability-inventory.json` in main (**174 API methods, 39 namespaces**; initial 140 inventory was incomplete). Inspect all source in `claude/import-r5-2-16-4-4-final`, `src/Index.html`, `src/FormPage.html`, product decisions D1–D8/N1–N7 and UX PR branches. For each of all 174 methods, record screen/action, role+course scope, backend contract, real UI integration, success/failure test, deployment evidence. Differences with earlier 168 and 140 inventories must be reconciled, not hidden.

**Modules:** course CRUD/archive/reopen, departments/teams/commander assignment, user admin, soldier full card including authorized emergency contact, soldier CRUD/reassign/cancel/restore/history, navigation, shooting, fitness components/versions/scoring/completion, exams/attempts/meeting triggers, attendance events/multiple absentees and early exits, marches, qualifications, readiness, incidents, assessments/notes/followups/favorites, task/meeting flows, alerts, dashboard, group-only insights, scoped reports and export, documents and evidence, personal form/Google Forms link and approvals, import/OCR preview and decision, backup/recover/migration/preflight/audit.

**No changed rules:** fitness newest attempt only; `out_of_range` review; `na` only configured; missing never 0; component fallback rules; no invented pass/fail thresholds; no automatic recomputation of saved scores; cancellations/archives visibility; export PDF/Excel admin only, commander preview scoped. Confirm full scoring transcription source instead of summarizing tables.

**Newest analytics constraint:** only **group-level** analytics, threshold N≥5 suppression, with no individual names/IDs, no individual performance rankings, no personal scatter/radar charts, no AI assessments of a soldier. Operational individual cards stay authorized and separate. All aggregate formulas, sources, freshness, data sufficiency and course-scope boundaries documented.

## 4. Today / real operational use — factual blockers and release gates
**The site currently available on GitHub Pages is a PUBLIC SYNTHETIC PREVIEW. Its 174 routes are dispatched in an in-memory engine, NOT proof that 174 workflows are accessible/usable end to end. Browser state resets on refresh. There is no real persisted, access-controlled operational server connected to that public URL.**

Before any REAL person/military data:
A. Organizational/Information Security **written authorization** for storing/processing personnel information, approved hosting/location, data retention, roles, logging and external processors. No approval = NO real use.
B. Private secured runtime/data storage **independent of Google for commanders/admin per latest product decision**, with deployment access controls, encryption, backup/recovery, audit, monitoring and rollback; public GitHub Pages cannot be the database or authentication system.
C. Commander onboarding and secure identity: full name/phone/4-digit PIN + approval/role/course assignment. PIN alone is insecure: verified phone/identity, salted slow hash, throttle/lockout, session revocation/expiry, secure cookies, CSRF/IDOR checks, server-side role/course scopes. Owner read-only account. Soldier Google Forms only for own updates, validated and reviewed.
D. Database migrations and contract mapping for all historical modules and 174 routes. Full positive/negative tests (admin/commander/unassigned/other course/archived/cancelled, exports and private contact), write idempotency and concurrency, Google Forms workflow, backup and recovery tests.
E. Reconcile live-only `Setup.gs` TEST helpers `createSyntheticPilotCourseOnce()` and `seedSyntheticSoldiersBatch()` before any Google push; do not overwrite live TEST deployment, sharing, triggers or permissions. Do not equate Node simulation with live Google/production tests.
F. Browser/phone QA on iPhone Safari and Android Chrome, RTL, 320–1440px, accessible screenreader/keyboard/touch, latency/large data, offline and errors; test CSV/PDF export/import and backup/restore under authorized TEST.
G. Explicit owner approval to transition from synthetic testing to real data, after external InfoSec/organizational clearance. "Do it today" is urgency, not release gate waiver.

**Safe thing we can use today without those gates:** a *synthetic-only* functional pilot in the original design, with no actual soldiers, no unsupported production readiness claims.

## 5. Execution order — produce implementation, not more plans
P0 **restore design immediately** using exact PR #10 source as structural+visual golden master. Do not revert to old 20-name demo behavior. Implement shell + live synthetic module bridge + initial 4 native routes (home, scoped soldiers and card, followups/tasks, more) and contextual entry to all other migrated screens. Preserve original quick-search pattern.
P0 establish `design_parity` snapshots at iPhone 390 and 360, visual comparison to PR #10.
P0 fix duplicated data sources and no iframe/old UI. Keep PR #33 one-app QA intent and update assertions to original 4 tabs. Test all routes with synthetic backend and no invented server results.
P1 integrate most-used write workflows: attendance, fitness, exams, navigation, shooting, readiness, qualifications; then reports/forms/admin/backup. Preserve backend business rules and role security.
P1 provide explicit coverage matrix where "backend route exists", "native screen exists", "synthetic E2E passes", "secured connected E2E passes", "real-use approved" are SEPARATE.
P2 obtain actual deployment verification and screenshot evidence; publish URL+commit+test logs+remaining blockers. Never say ready for real data until security gates pass.

**Do not stop at CSS-only cosmetic patch or another documentation PR.** Submit coding PRs, verify CI browser tests, and deploy updated synthetic original-style UI. Fix regressions before calling owner. If protected operational deployment is not possible, report exact permissions/approvals needed, and continue completing testable code. No hardcoded personal information or secrets in public repo.

## 6. Owner management agreement
The owner wants decisive autonomous development, minimum status interruptions, no recurring confirmations, no pushing manual code editing onto him, and a complete usable app rather than a mockup. **Work independently where tools permit**, always distinguish implemented/verified from pending, and stop only for genuine access, security, procurement or policy decisions. Owner should be told whenever Claude receives a new task so he can start Claude; a GitHub comment alone will NOT start an autonomous Claude session.
