#!/usr/bin/env sh
#
# Equoria-9ai5g — shared-working-tree detector.
#
# WHY THIS EXISTS. On 2026-09-11 two interactive Claude sessions worked in the
# same checkout on the same branch. The second session's in-progress commit
# became an ancestor of the first session's branch tip, so the first session's
# 80-commit push to master would have carried the other session's half-finished
# revert with it. Nothing detected that. What stopped it was luck: an unrelated
# `git merge` refused because an uncommitted change would have been overwritten.
#
# The owner's ruling (2026-09-14, on Equoria-9ai5g) was DETECT, not prevent:
# "a session-start or pre-commit check comparing the dirty set and recent
# commit authorship against what this session believes it did".
#
# WHAT THIS IS. A session CLAIMS the checkout by writing a small state file
# inside the git directory. Later commits and pushes from a DIFFERENT session
# are refused, loudly, naming the other session and the offending paths or
# commits. It never fails silently and it never blocks without an override.
#
# WHERE THE STATE LIVES.
#   "$(git rev-parse --git-dir)"/equoria-session.json
# Inside the git directory on purpose: it is never tracked, never appears in
# the working tree, and never needs a .gitignore entry. For a linked worktree
# `git rev-parse --git-dir` resolves to that worktree's PRIVATE gitdir
# (.git/worktrees/<name>), NOT the shared common dir — which is exactly what we
# want, because the unit being claimed is one working tree, and two worktrees
# of one repository are the SOLUTION to this problem, not the problem.
#
# NOT A LOCK. A claim does not stop anything by itself; it only lets the next
# commit or push tell whether it belongs to the session that claimed the tree.
# Stale claims (older than STALE_SECONDS) are taken over with a warning rather
# than blocking work after a crashed session.
#
# Subcommands:
#   claim     — claim the checkout (session start); report a live foreign claim
#   precommit — refuse a commit from a session that does not own the claim
#   prepush   — refuse a push that carries another session's commits
#   status    — print the current claim (no writes, never fails)
#
# Override for every refusal: EQUORIA_SESSION_OVERRIDE=1
# No-op in CI (CI / GITHUB_ACTIONS), where there is one session by definition.

set -u

STALE_SECONDS=28800   # 8 hours

# ---------------------------------------------------------------- environment

# CI never has two interactive sessions sharing a checkout, and a hard refusal
# there would be noise at best and a broken pipeline at worst.
in_ci() {
  [ "${CI:-}" = "true" ] || [ "${CI:-}" = "1" ] || [ -n "${GITHUB_ACTIONS:-}" ]
}

overridden() {
  [ "${EQUORIA_SESSION_OVERRIDE:-}" = "1" ]
}

proc_start() {
  # Field 22 of /proc/<pid>/stat is the process start time. Present under MSYS2
  # (Windows Git Bash) and Linux; empty if unreadable. It makes a recycled pid a
  # different session instead of a silently inherited claim.
  awk '{ print $22 }' "/proc/$1/stat" 2>/dev/null || true
}

# The session token must be computable INDEPENDENTLY by every hook process —
# a hook cannot ask the session who it is, it can only inherit environment.
# Precedence, most reliable first:
#   1. EQUORIA_SESSION_ID     — explicit, set by a human or a wrapper.
#   2. CLAUDE_CODE_SESSION_ID — exported by Claude Code into every tool process,
#      git hooks included (verified 2026-09-15 on 2.1.270). Shared by a session
#      and its subagents, which is correct: one session and its agents are one
#      owner of one tree.
#   3. parent pid + start time — last resort. Weak: stable only while the SAME
#      parent process drives every hook invocation. When it is used, the guard
#      says so rather than pretending to certainty.
session_id() {
  if [ -n "${EQUORIA_SESSION_ID:-}" ]; then
    printf 'env:%s' "$EQUORIA_SESSION_ID"
  elif [ -n "${CLAUDE_CODE_SESSION_ID:-}" ]; then
    printf 'cc:%s' "$CLAUDE_CODE_SESSION_ID"
  elif [ -n "${CLAUDE_PID:-}" ]; then
    printf 'pid:%s.%s' "$CLAUDE_PID" "$(proc_start "$CLAUDE_PID")"
  else
    printf 'pid:%s.%s' "$PPID" "$(proc_start "$PPID")"
  fi
}

session_id_is_weak() {
  [ -z "${EQUORIA_SESSION_ID:-}" ] && [ -z "${CLAUDE_CODE_SESSION_ID:-}" ]
}

state_file() {
  printf '%s/equoria-session.json' "$(git rev-parse --git-dir)"
}

# ------------------------------------------------------------------ git facts

# One path per line. Renames ("R  old -> new") contribute the destination, the
# path a later commit would actually stage.
dirty_paths() {
  git status --porcelain 2>/dev/null |
    cut -c4- |
    sed -e 's/^.* -> //' -e 's/^"//' -e 's/"$//'
}

staged_paths() {
  git diff --cached --name-only 2>/dev/null
}

# ------------------------------------------------------------- state file i/o

json_escape() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

write_claim() {
  _sf="$(state_file)"
  _sid="$1"
  {
    printf '{\n'
    printf '  "schema": 1,\n'
    printf '  "session": "%s",\n' "$(printf '%s' "$_sid" | json_escape)"
    printf '  "claimed_at": %s,\n' "$(date +%s)"
    printf '  "branch": "%s",\n' "$(git rev-parse --abbrev-ref HEAD 2>/dev/null | json_escape)"
    printf '  "head": "%s",\n' "$(git rev-parse HEAD 2>/dev/null || printf 'unborn')"
    printf '  "dirty": [\n'
    dirty_paths | json_escape | sed -e 's|^|    "|' -e 's|$|",|' | sed -e '$ s/,$//'
    printf '  ]\n'
    printf '}\n'
  } > "$_sf.tmp$$" && mv -f "$_sf.tmp$$" "$_sf"
}

claim_field() {
  # Scalar field out of the one-key-per-line JSON we write ourselves. Strip the
  # trailing comma FIRST: a value read as "1789442012," is not a number, and a
  # claim whose age silently parses as 0 would never be seen as stale.
  sed -n "s/^  \"$1\": //p" "$(state_file)" 2>/dev/null |
    head -1 |
    sed -e 's/,$//' -e 's/^"//' -e 's/"$//'
}

claim_dirty_to() {
  sed -n '/^  "dirty": \[/,/^  \]/p' "$(state_file)" 2>/dev/null |
    sed -e '1d' -e '$d' -e 's|^    "||' -e 's|",\{0,1\}$||' > "$1"
}

claim_age_seconds() {
  _at="$(claim_field claimed_at)"
  case "$_at" in ''|*[!0-9]*) printf '0'; return;; esac
  printf '%s' "$(( $(date +%s) - _at ))"
}

human_age() {
  _s="$1"
  if [ "$_s" -lt 3600 ]; then printf '%dm' "$(( _s / 60 ))"
  else printf '%dh%dm' "$(( _s / 3600 ))" "$(( (_s % 3600) / 60 ))"; fi
}

override_hint() {
  echo "$1   If you are certain this is your own work, re-run with" >&2
  echo "$1   EQUORIA_SESSION_OVERRIDE=1. Otherwise the safe move is a" >&2
  echo "$1   dedicated worktree: git worktree add ../<name> -b <branch>" >&2
}

# ------------------------------------------------------------------ claim cmd

cmd_claim() {
  if in_ci; then return 0; fi
  _me="$(session_id)"
  _sf="$(state_file)"

  if [ -f "$_sf" ]; then
    _owner="$(claim_field session)"
    _age="$(claim_age_seconds)"
    if [ "$_owner" = "$_me" ]; then
      write_claim "$_me"
      echo "[session-guard] checkout re-claimed by this session ($_me)."
      return 0
    fi
    if [ "$_age" -ge "$STALE_SECONDS" ]; then
      echo "[session-guard] WARNING: taking over a STALE claim."
      echo "[session-guard]   previous session: $_owner (age $(human_age "$_age"))"
      echo "[session-guard]   Stale means older than $(( STALE_SECONDS / 3600 ))h, not proven dead."
      echo "[session-guard]   If that session is still running, STOP and use a worktree."
      write_claim "$_me"
      return 0
    fi
    echo "[session-guard] ANOTHER LIVE SESSION HOLDS THIS CHECKOUT."
    echo "[session-guard]   session : $_owner"
    echo "[session-guard]   age     : $(human_age "$_age")"
    echo "[session-guard]   branch  : $(claim_field branch)"
    echo "[session-guard]   head    : $(claim_field head)"
    echo "[session-guard]   Its uncommitted work is in the tree you are about to edit."
    echo "[session-guard]   A reset, checkout, stash or branch move here destroys it."
    echo "[session-guard]   Work in your own worktree instead:"
    echo "[session-guard]     git worktree add ../equoria-<task> -b <branch>"
    echo "[session-guard]   The claim was NOT taken over; commits from here will be refused."
    return 0
  fi

  write_claim "$_me"
  echo "[session-guard] checkout claimed by this session ($_me)."
  if session_id_is_weak; then
    echo "[session-guard]   NOTE: no EQUORIA_SESSION_ID or CLAUDE_CODE_SESSION_ID in the"
    echo "[session-guard]   environment — the session token falls back to a parent pid and"
    echo "[session-guard]   is only as stable as that process. Export EQUORIA_SESSION_ID"
    echo "[session-guard]   for a reliable identity."
  fi
  return 0
}

# -------------------------------------------------------------- precommit cmd

cmd_precommit() {
  if in_ci; then return 0; fi
  _me="$(session_id)"
  _sf="$(state_file)"

  # No claim yet: claim it and proceed. The first commit in a checkout is never
  # the suspicious one.
  if [ ! -f "$_sf" ]; then
    write_claim "$_me"
    return 0
  fi

  _owner="$(claim_field session)"
  _age="$(claim_age_seconds)"

  if [ "$_owner" = "$_me" ]; then
    write_claim "$_me"   # refresh: branch, head and dirty set move as I work
    return 0
  fi

  if [ "$_age" -ge "$STALE_SECONDS" ]; then
    echo "[session-guard] WARNING: this checkout was claimed by another session" >&2
    echo "[session-guard]   ($_owner, age $(human_age "$_age")) — stale, taking it over." >&2
    write_claim "$_me"
    return 0
  fi

  # The incident's shape: a session that does not own the tree commits its OWN
  # new work into it, and that commit becomes an ancestor of the owner's branch
  # tip. So the signal is staged paths the claiming session's snapshot did not
  # contain.
  _snap="$(state_file).snap$$"
  claim_dirty_to "$_snap"
  _foreign="$(staged_paths | grep -Fxv -f "$_snap" || true)"
  _overlap="$(staged_paths | grep -Fx -f "$_snap" || true)"
  rm -f "$_snap"

  if [ -z "$_foreign" ]; then
    if [ -n "$_overlap" ]; then
      echo "[session-guard] WARNING: session $_owner claimed this checkout and every" >&2
      echo "[session-guard]   staged path was already dirty in ITS snapshot:" >&2
      printf '%s\n' "$_overlap" | sed 's/^/[session-guard]     /' >&2
      echo "[session-guard]   You may be committing that session's uncommitted work." >&2
    fi
    return 0
  fi

  if overridden; then
    echo "[session-guard] OVERRIDE: committing over session $_owner's claim on this checkout." >&2
    write_claim "$_me"
    return 0
  fi

  echo "" >&2
  echo "[session-guard] REFUSING THE COMMIT — this checkout belongs to another session." >&2
  echo "[session-guard]   claiming session : $_owner (age $(human_age "$_age"))" >&2
  echo "[session-guard]   this session     : $_me" >&2
  echo "[session-guard]   claimed branch   : $(claim_field branch)" >&2
  echo "[session-guard]" >&2
  echo "[session-guard]   Staged paths that were NOT in that session's snapshot:" >&2
  printf '%s\n' "$_foreign" | sed 's/^/[session-guard]     /' >&2
  if [ -n "$_overlap" ]; then
    echo "[session-guard]   Also staged, and already dirty for that session:" >&2
    printf '%s\n' "$_overlap" | sed 's/^/[session-guard]     /' >&2
  fi
  echo "[session-guard]" >&2
  echo "[session-guard]   Committing here puts your work on the branch the other session" >&2
  echo "[session-guard]   is about to push, under a message describing something else." >&2
  override_hint "[session-guard]"
  echo "" >&2
  return 1
}

# ---------------------------------------------------------------- prepush cmd

cmd_prepush() {
  if in_ci; then return 0; fi
  _me="$(session_id)"
  _sf="$(state_file)"
  [ -f "$_sf" ] || return 0

  _upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [ -z "$_upstream" ]; then
    # Nothing to compare against; say so rather than implying a clean check.
    echo "[session-guard] no upstream for this branch — cross-session push check skipped."
    return 0
  fi

  _range="$_upstream..HEAD"
  _count="$(git rev-list --count "$_range" 2>/dev/null || printf '0')"
  [ "$_count" -gt 0 ] || return 0

  _owner="$(claim_field session)"
  _age="$(claim_age_seconds)"
  _npairs="$(git log --format='%ae|%ce' "$_range" 2>/dev/null | sort -u | grep -c . || true)"

  _reason=""
  # (a) The ruling's rule: more than one distinct author/committer identity in
  #     the push, and this session does not hold the claim.
  if [ "$_npairs" -gt 1 ] && [ "$_owner" != "$_me" ]; then
    _reason="the push mixes $_npairs author/committer identities and this session does not hold the claim"
  fi
  # (b) The rule that would actually have caught the 2026-09-11 incident, where
  #     BOTH sessions committed under the same git identity: the claim is
  #     foreign and live, and there are unpushed commits. Identity is not
  #     evidence of authorship when every session shares one git user.
  if [ -z "$_reason" ] && [ "$_owner" != "$_me" ] && [ "$_age" -lt "$STALE_SECONDS" ]; then
    _reason="this checkout is claimed by another live session and the push carries $_count commit(s) made in it"
  fi
  # (c) Foreign identities inside a push from the claim holder.
  if [ -z "$_reason" ] && [ "$_npairs" -gt 1 ]; then
    _reason="the push carries $_npairs distinct author/committer identities"
  fi

  [ -n "$_reason" ] || return 0

  if overridden; then
    echo "[session-guard] OVERRIDE: pushing anyway — $_reason." >&2
    return 0
  fi

  echo "" >&2
  echo "[session-guard] REFUSING THE PUSH — $_reason." >&2
  echo "[session-guard]   claiming session : $_owner (age $(human_age "$_age"))" >&2
  echo "[session-guard]   this session     : $_me" >&2
  echo "[session-guard]   range            : $_range ($_count commit(s))" >&2
  echo "[session-guard]" >&2
  echo "[session-guard]   Commits that would be pushed:" >&2
  git log --format='%h %an <%ae> %ad %s' --date=short "$_range" 2>/dev/null |
    sed 's/^/[session-guard]     /' >&2
  echo "[session-guard]" >&2
  echo "[session-guard]   Read that list before overriding: a commit you did not make" >&2
  echo "[session-guard]   inside it is another session's unfinished work." >&2
  override_hint "[session-guard]"
  echo "" >&2
  return 1
}

# ----------------------------------------------------------------- status cmd

cmd_status() {
  _sf="$(state_file)"
  if [ ! -f "$_sf" ]; then
    echo "[session-guard] no claim on this checkout ($_sf)."
    return 0
  fi
  _mine=no
  [ "$(claim_field session)" = "$(session_id)" ] && _mine=yes
  echo "[session-guard] claim: $(claim_field session)"
  echo "[session-guard]   age    : $(human_age "$(claim_age_seconds)")"
  echo "[session-guard]   branch : $(claim_field branch)"
  echo "[session-guard]   head   : $(claim_field head)"
  echo "[session-guard]   mine   : $_mine"
  return 0
}

case "${1:-status}" in
  claim)     cmd_claim ;;
  precommit) cmd_precommit ;;
  prepush)   cmd_prepush ;;
  status)    cmd_status ;;
  *)
    echo "usage: session-guard.sh {claim|precommit|prepush|status}" >&2
    exit 2
    ;;
esac
