#!/usr/bin/env bash
# Negative + positive tests for the release gates (run in PR CI). Needs a repo with origin/main fetched.
set -euo pipefail; cd "$(dirname "$0")/.."
main_sha="$(git rev-parse origin/main)"
bash scripts/assert_main_ancestor.sh "$main_sha"                                           && echo "PASS main tip accepted"
bash scripts/assert_main_ancestor.sh "$(git rev-parse origin/main~1)"                      && echo "PASS an older main commit (rollback target) accepted"
tmp="$(mktemp -d)"; export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@x.com GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@x.com
git worktree add -q --detach "$tmp" "$main_sha"; ( cd "$tmp" && git commit -q --allow-empty -m "unmerged experiment" && echo "$(git rev-parse HEAD)" > "$tmp/../unmerged_sha_$$" ) ; unmerged="$(cat "$tmp/../unmerged_sha_$$")"; rm -f "$tmp/../unmerged_sha_$$"
if bash scripts/assert_main_ancestor.sh "$unmerged" 2>/dev/null; then echo "FAIL unmerged commit was accepted"; exit 1; else echo "PASS unmerged commit rejected"; fi
if bash scripts/assert_main_ancestor.sh "main" 2>/dev/null; then echo "FAIL a branch name was accepted"; exit 1; else echo "PASS branch names / short refs rejected"; fi
if bash scripts/assert_main_ancestor.sh "0000000000000000000000000000000000000000" 2>/dev/null; then echo "FAIL unknown sha accepted"; exit 1; else echo "PASS unknown sha rejected"; fi
git worktree remove --force "$tmp"
# staging never publishes anything outside the allow-list, even if the preview dir contains extra/forbidden files
d="$(mktemp -d)"; cp preview/* "$d"/; mkdir -p "$d/server_public"; echo x > "$d/server_public/client.js"; echo x > "$d/shot.png"
out="$(mktemp -d)"; node scripts/stage_pages_site.js "$d" "$out/site" "$main_sha" 1 >/dev/null; node scripts/scan_pages_artifact.js "$out/site" >/dev/null && ! ls "$out/site" | grep -E "server_public|shot.png" && echo "PASS staging copies only the allow-list"
node scripts/stage_pages_site.js preview "$out/real" "$main_sha" 1 >/dev/null && node scripts/scan_pages_artifact.js "$out/real" && grep -q "$main_sha" "$out/real/build-info.json" && echo "PASS real preview staged, scanned, SHA-stamped"
echo "PAGES RELEASE GATE TESTS OK"
