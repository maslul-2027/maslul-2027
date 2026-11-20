#!/usr/bin/env bash
# Only commits that are part of the reviewed main history may be published (also for rollback). Usage: scripts/assert_main_ancestor.sh <sha> [main-ref]
set -euo pipefail
sha="${1:?sha required}"; main="${2:-origin/main}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "REJECTED: not a full 40-hex commit sha: $sha" >&2; exit 1; }
git cat-file -e "${sha}^{commit}" 2>/dev/null || { echo "REJECTED: commit not found: $sha" >&2; exit 1; }
if git merge-base --is-ancestor "$sha" "$main"; then echo "OK: $sha is in the history of $main"; else echo "REJECTED: $sha is not reachable from $main (unmerged / unreviewed)" >&2; exit 1; fi
