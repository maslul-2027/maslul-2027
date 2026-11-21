# Backup & restore — private TEST server and Windows package (Issue #72, part 2) — SYNTHETIC DATA ONLY

Scope: a backup now covers **both** the system data **and** the stored report files, and the in-app routes `backup.create`, `backup.verify`, `backup.plan`, `backup.restore`, `backup.recover`, `backup.prune` really work in the **private TEST server / Windows package** (admin only). Documents (`docs.*`) are the next PR; OCR stays NOT_CONNECTED; `migration.run` stays blocked.

## Two layers (what protects what)
| Layer | Where | Contains | Used by |
|---|---|---|---|
| **In-app backup** (engine `src/Backup.gs`) | `<data>/files/` (encrypted JSON of all data tables) + `<data>/backups/<id>/` (byte-for-byte encrypted copies of every stored file + HMAC manifest) | tables (all except AuditLog, BackupJobs, ReportJobs, Users, SchemaMeta — engine policy, unchanged) + report files | the app (More → גיבוי ובדיקות מערכת), same running server |
| **Full offline backup** (`backend_next/full_backup.js`) | `<data>/backups/full-backup-*.mbk` | the **whole** encrypted `state.bin` (users, sessions, audit chain, engine) + every stored file; one container, per-entry SHA-256, HMAC header | `BACKUP-NOW.cmd` / `RESTORE-BACKUP.cmd` (launcher `--backup/--restore`; the app must be closed to restore) |

## Consistency guarantees (tested)
* A snapshot is taken inside **one synchronous engine call**: no report can be created between the table snapshot and the file snapshot. (Offline: state is read first, files after — a file may exist without its row, never the reverse.)
* The manifest is written **last, atomically** (no manifest = incomplete = unusable). A live file that fails its own authentication is **not copied** and is reported (`skipped_corrupt`) — a corrupt copy never looks like a good backup.
* Size bound: 500 MB / 5000 files per backup; over the bound → refused, nothing left behind.
* Restore is **staged**: manifest MAC, per-file SHA-256 and AES-GCM authenticity (with this installation's key) are verified and the files copied to a staging folder **before** any live byte changes. Files are only **added or repaired — never deleted**; a divergent live file goes to `.quarantine`, not silently overwritten. A newer report created after the backup is kept.
* Durable rollback before mutation: in-app = the engine's automatic `pre_restore` backup (state **and** files) + marker; offline = `restore-rollback-<ts>/` + `restore-in-progress.json`. A failure rolls everything back; a crash is finished/undone at the next start (`recover`). The state file is swapped **last**.
* After a successful restore/recover **all sessions are revoked** (everyone signs in again) and the gateway audit records it.

## Protections against loss / misuse
* **Admin only** (engine policy `backup.run/restore`; commander, foreign-team commander, viewer, anonymous are refused — tested for every route).
* **Plan first, then confirm**: `backup.restore` is refused unless the same admin viewed `backup.plan` (table differences + file differences: missing / damaged / newer-kept) in the last 10 minutes; the plan view is **single-use** (a failed attempt also consumes it). Then an explicit `confirm: "RESTORE"` and a written reason (≥5 chars). `recover` needs `confirm: "RECOVER"` + reason. `prune` needs `confirm: "PRUNE"`, **keeps at least 3**, supports `dry_run`, never deletes `pre_restore` backups, and removes the pruned backup's files **and** snapshot folder.
* A second restore is refused while an earlier one is marked in progress (engine `RESTORE_IN_PROGRESS`) until `recover`.
* Path safety: backup ids and entry names are validated (`f_<32 hex>` / `state.bin` only) — no traversal, absolute names, executables or zip-slip; the container is parsed with length checks (no trailing/truncated data).
* Backups are encrypted at rest (ciphertext copies; manifest has ids/sizes/hashes only — no names, no content).

## Key / secret portability (limitation, by design)
Files and state are encrypted with keys derived from `<data>/secrets.json` (`storeKey`). **No backup contains a key** and no plaintext secret is exported. Therefore a backup restores **only into the same installation** (same `secrets.json`). A different/missing key fails closed (manifest MAC + GCM) — tested. To move to a new machine, copy the data folder **including** `secrets.json` through an approved secure channel. There is no portable KDF / approved key custody in this TEST, so no cross-installation restore is offered.

## What is NOT claimed
* **No unattended/daily automatic backup**: the engine has a daily-job function, but nothing schedules it in this server. Backups are taken when an admin presses the button or runs `BACKUP-NOW.cmd`.
* Backups sit on the same disk as the data (protection against mistakes/corruption, not against disk loss) — copy the `.mbk` file elsewhere yourself.
* The offline backup does not include the in-app backup folders; in-app backups reference files by id and are lost with the data folder.
* Not run on real military data; not run on a clean user Windows PC; two-phone pilot still NOT_RUN.

## Route truth table (private TEST server; public demo unchanged)
| Route | Before | After | Evidence |
|---|---|---|---|
| `backup.create` | NOT_CONNECTED | works (state + files snapshot) | tests/backup_restore.js, browser E2E (UI) |
| `backup.verify` | NOT_CONNECTED | works (checksum + file set) | same |
| `backup.plan` | NOT_CONNECTED | works (table + file diff) | same |
| `backup.restore` | NOT_CONNECTED | works (plan → confirm → staged, rollback, sessions revoked) | same |
| `backup.recover` | NOT_CONNECTED | works (interrupted restore) | same |
| `backup.prune` | NOT_CONNECTED | works (dry-run, confirm, min 3) | same |
| `backup.list` | works | works (+ restore markers visible) | — |
| `docs.upload`, `docs.download`, `ocr.start`, `migration.run` | unchanged | unchanged (next PRs / blocked) | — |
The public-demo ledger (158 / 5 / 13) is regenerated from the public demo run and unchanged: the demo has no storage, so these routes stay `BLOCKED_NOT_CONNECTED` there, and their notes point here.
