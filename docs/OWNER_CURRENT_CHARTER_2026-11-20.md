# MASLUL 2027 — Owner's current instructions, 20 November 2026

**Status:** execution charter and implementation acceptance criteria. This overrides *contradictory* older proposals; does not approve production data or deployment. Read alongside original source and approved D1–D8/N1–N7 business rules. Do not declare completed features without runtime evidence.

## Mandatory result
Ship **one cohesive, fast, mobile-first, accessible, intuitive Hebrew RTL application** with the **complete approved functional scope** from the four project chats and legacy source. The owner explicitly rejected: a good-looking empty demo, a web app embedded inside another app, 39 bare menus, an overloaded UI, and redesigns that discard the previous clean visual direction. Reuse the visual standard of the initial approved white/navy/teal minimal PWA with restrained red for exceptions, and apply it to **every workflow**, not just the home screen.

**Immediate urgency:** owner wants the strongest *actually working and tested* version accessible on mobile by morning 20 Nov 2026 Israel time. No 7-day planning cycle; implement and test now. A time target is not permission to bypass authentication, security, real-data approval or claim false production readiness.

## Current owner architectural preference (newer than prior Google-centric handoff)
- **Operational app should be independent of Google for commanders and administration**. Admin has complete role-scoped management, commanders enter/update only their assigned scopes, and soldiers use **Google Forms only for updating their own card**, subject to approval and appropriate security.
- Commander enrollment: full name, phone, 4-digit PIN, admin approval + assignment. Never treat PIN alone as sufficient online authentication; include verification, salted slow hashing, throttling, lockouts, revocable sessions and server-side access controls.
- Product owner: separate personal **read-only** oversight view.
- The Apps Script source is a **functional/business-rule reference and migration baseline**, not an authorization to expose its protected TEST database or port its Google identity mechanism insecurely. Separate the legacy compatibility branch from a secure new operational backend. Select hosting/storage only with appropriate approval, especially for military data.

## Latest analytics restrictions — override older radar/scatter report proposals
- **Analytics only at GROUP level**, with N≥5 small-cell suppression and role/course scoping applied before aggregation.
- Preserve aggregate KPIs, trends, comparisons, explainable insights, tabular reports, inclusion of inactive where explicitly configured, scoring/history/permission constraints.
- **Exclude individual names, identifiers, personal numbers and personal achievement/ranking, scatter plots, radar charts from analytics**. No inferred individual soldier assessment.
- Keep individual operational records and evidence separate, visible only to authorized admin/commander scope; do not confuse an operational soldier card with an analytics report.
- Existing PDF mockup/reference of a 5-page report is **not authority** to reintroduce prohibited personal charts or data.

## Scope to retain, not fake
- Courses, organizational structure, commanders, approval and scope.
- Complete soldier roster and full scoped soldier card including one primary emergency contact where original schema supports it; creation, edit, reassignment, cancellation/restore and history.
- Marksmanship, fitness/scoring, navigation, theoretical exams, attendance, marches, qualifications/readiness, training events, notes, assessments, records/corrections, tasks, meetings, alerts/followups, favorites/recents.
- Settings, dashboards, group-only analytics, reports/preview/export with server enforced admin-only full exports, forms, docs/ocr/import, backup/migration/preflight/audit.
- Every currently inventoried legacy API action in `docs/capability-inventory.json` (174 across 39 namespaces) must be tracked individually, plus older-version routes/UI functionality missing from that whitelist. A method merely listed in source does not count as working.

## Reconciled repository progress (verified current main)
- `docs/capability-inventory.json` on `main` now declares **174 actions / 39 groups**, not 140; PR #16 discovered and restored 34 omitted routes. Any handoff or test asserting 140 is obsolete and must be corrected.
- PR #23–#31 show a rapidly evolving synthetic course engine, original UI integration, unified shell, design migration, home restoration, roster and deployment fixes. **Check their open/merged state and code/CI before making further changes**; do not overwrite active contributions or assume PR numbers imply merge.
- `main/preview/index.html` may still differ from active PR branches. Product owner judges the actually deployed mobile result, not isolated PR screenshots.

## UX execution requirements
- App shell with 4 high-level mobile navigation choices; context-aware commands, recent/favorite/search, progressive disclosure of domains. Avoid lengthy tab strips, duplicate headers or nesting one app frame in another.
- Every screen uses same typography, spacing, restrained color and responsive components. 44px touch targets; accessible focus, labels, screen-reader announcements, keyboard, RTL and no page horizontal overflow at 320–1440px.
- Loading, empty, permission-denied, offline, retry and server-confirmed saved states; clear action summary and navigation back/forward.
- Keep the originally liked clean layout; do not use a generic embedded legacy-app panel.

## Non-negotiable engineering gates
- Source reconciliation: private TEST-only Setup.gs helpers `createSyntheticPilotCourseOnce()` and `seedSyntheticSoldiersBatch()` must not be overwritten by `clasp push`. Do not change existing TEST permissions, sheet sharing, data, triggers, production, or Apps Script deployment without owner consent.
- GitHub Pages `preview/` is a **synthetic-only public PWA** and not a secure production app. No military/personal data in public GitHub, Pages, logs, screenshots or unaudited external services.
- Source identity, server-side role/record authorization, cross-course isolation, privacy, audit, action idempotency, rollback, backup/restore, scoring invariants and concurrency tests. Keep D1–D8/N1–N7 unchanged.
- Verify browser and real Google TEST or replacement server as applicable; distinguish NODE_SIM from actual connected E2E tests; don't call static smoke tests proof of end-to-end readiness.
- No real personnel data or operational production deployment without explicit owner consent and organizational security approval.

## What to do, starting NOW
1. Read the whole legacy `src/Index.html` (large, actual operational app), `src/Code.gs`, domain modules, full tests, decisions, and current GitHub branches/PRs. Do not rewrite from demo alone.
2. Build an exhaustive route / API / screen / authorization / business-rule **parity matrix** and separate operational personal cards from group analytics. Include current connection and test status.
3. Implement one **integrated design system and functional mobile shell** around preserved workflows, progressively replacing legacy UI, not iframe/embed or fake buttons. Commit incremental, reviewable PRs with actually working slices.
4. Establish secure backend migration independent of Google operational login. When blocked on hosting or data approvals, continue a fully functional **isolated synthetic deployment** behind appropriate controls; do not misrepresent it as real-personnel-ready.
5. Run browser checks, CI, role denial, cross-scope, latency, accessibility, data contract and duplicate-submit scenarios. Publish functioning preview URL, commit IDs, evidence and remaining gaps.
6. Work independently within connected tool capabilities; only stop for real security/approval/access blockers. Do not request the owner to manually copy/edit dozens of files.
7. **When assigning a task to Claude, inform the owner explicitly with link and a concise instruction so he can start Claude.** GitHub comments alone do not trigger Claude.

## Definition of done
Full original business rules and all approved operations exist as **functional**, accessible, coherent UI workflows, backed by secured services and validated with role-scoped tests. If any ability is still a synthetic preview, clearly label it as such and keep it off the completed list. Final real-data use only after approvals and evidence.

## Audit note
Owner supplied four public ChatGPT share URLs for original conversations:
- https://chatgpt.com/share/6aff83f9-d18c-83eb-bb9b-b0cf15449fb9
- https://chatgpt.com/share/6aff8569-c14c-83ed-97eb-de7ba1d7d411
- https://chatgpt.com/share/6aff858b-3114-83ed-9dbd-5be02a8263b5
- https://chatgpt.com/share/6aff85b0-d614-83ed-bbe0-c54c71542075

These URLs were **not fetchable in the current web tool**. The directives above are based on accessible project-conversation context and repo records. Next execution environment should open original shares and reconcile the full conversation text; do not claim the URLs themselves were reviewed unless they actually were.

## Source-audit amendments (20 Nov 2026; based on MASLUL_2027_source_audit.md)
- Meetings/tasks are **not a generic standalone task editor**: tasks originate only from the meeting summary, entered by the meeting summarizer. One responsible person; due date; optional hour; priority; notes. Completion by responsible owner or admin. No task visibility to soldiers; dashboard-only alerts; no team-sliced task alerts. Full audit/cancellation and concurrency behavior must be preserved. Existing code appears to bind tasks to `meetings.save`, but deploy-level verification is pending.
- Standard fitness scoring weights documented in source audit: **20/20/20/10/30**; missing is not zero. The authoritative approved scoring source is still the original transcription and locked decisions, not this abbreviated statement. Men's 7 kg personal vest; women's one repetition = 40 and zero triggers review; reject unapproved fallback tables.
- Default organizational structure: **two departments and four teams**, as defined by source. Structure/config-only course clone, **not records or permissions** by default; existing `courses.create clone_from` needs fully verified admin UI.
- Task attachments under document authorization remain an identified integration gap; do not declare implemented by merely showing the global docs section.
- Original audit reports **61 focused local tests passing** (26 meetings, 16 meeting QA, 11 fitness, 8 fitness governance) on the inspected baseline; Google end-to-end is unverified. Do not transpose these results onto a different commit.
- The transferred source bundle also lists `FEATURE_SPEC_MEETING_TASKS_HE_EN_v1.md`, `MEETING_SUMMARY_TASKS_AND_CONTINUATION_HE_EN_v1.md`, `PRODUCT_DECISIONS_LOCKED.md`, `UX_SPEC_MEETING_TASKS_HE_EN_v1.md`, `אמנת_עבודה_משותפת_מעודכנת.docx`, and a detailed fitness scoring spreadsheet. **Open and read their exact contents before implementing their requirements**; a filename in an audit is not equivalent to reading the document.
