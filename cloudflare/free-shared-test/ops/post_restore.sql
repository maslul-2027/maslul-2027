-- RUN THIS IMMEDIATELY AFTER ANY D1 Time Travel restore (operator only, Cloudflare dashboard -> D1 -> Console, or `wrangler d1 execute DB --remote --file ops/post_restore.sql`).
-- A restore rewinds EVERY table, including users and sessions, to the chosen minute:
--   * a session that was revoked after that minute would be valid again  -> revoke ALL sessions now (everyone logs in again);
--   * the result cache may hold answers computed after that minute        -> clear it;
--   * a user removed after that minute may be active again               -> the admin must re-check the user list (docs/CLOUDFLARE_FREE_TEST.md, runbook step 6).
UPDATE sessions SET revoked = 1;
DELETE FROM cache;
DELETE FROM rate;
INSERT INTO audit (at, ev, data) VALUES (CAST(strftime('%s','now') AS INTEGER) * 1000, 'operator_post_restore', '{"sessions":"all revoked","cache":"cleared"}');
