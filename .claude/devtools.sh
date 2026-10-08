#!/usr/bin/env bash
# Local dev tooling for this repo lives on the orphan branch `devtools`
# (CLAUDE.md, .claude/, e2e/). It is never merged and never PR'd.
#
#   restore: git fetch origin devtools && git archive origin/devtools | tar -x && bash .claude/devtools.sh restore
#   save:    bash .claude/devtools.sh save "message"
set -euo pipefail

BRANCH=devtools
PATHS=(CLAUDE.md .claude e2e)
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

exclude() {
  local file
  file="$(git rev-parse --git-path info/exclude)"
  grep -qx 'e2e/' "$file" 2>/dev/null && return
  printf '\n# local dev tooling (never commit; lives on the %s branch)\nCLAUDE.md\n.claude/\ne2e/\n' "$BRANCH" >> "$file"
}

case "${1:-}" in
  restore)
    git fetch -q origin "$BRANCH"
    git archive "origin/$BRANCH" | tar -x
    exclude
    (cd e2e && bun install >/dev/null)
    echo "devtools restored; git status should be clean:"
    git status --short
    ;;
  save)
    msg="${2:-update devtools}"
    tmp="$(mktemp -d)"
    git fetch -q origin "$BRANCH"
    git worktree add -q "$tmp" "origin/$BRANCH" --detach
    for p in "${PATHS[@]}"; do
      rm -rf "${tmp:?}/$p"
      cp -a "$p" "$tmp/"
    done
    rm -rf "$tmp/e2e/node_modules" "$tmp/e2e/test-results" "$tmp/e2e/playwright-report"
    # .git/info/exclude is shared by all worktrees, so force-add
    git -C "$tmp" add -A -f "${PATHS[@]}"
    if git -C "$tmp" diff --cached --quiet; then
      echo "no changes"
    else
      git -C "$tmp" commit -q -m "$msg"
      git -C "$tmp" push -q origin "HEAD:$BRANCH"
      echo "saved to $BRANCH"
    fi
    git worktree remove --force "$tmp"
    ;;
  *)
    echo "usage: $0 restore|save [message]" >&2
    exit 1
    ;;
esac
