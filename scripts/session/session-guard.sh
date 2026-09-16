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
# WHICH DIRECTION IT ACTUALLY CATCHES. One, not two. The guard bites at the
# NON-HOLDER's pre-commit and at the NON-HOLDER's push. The claim HOLDER's own
# push is checked only for differing author/committer identities, and in this
# repository every session commits as the same git user — so a holder pushing a
# branch that already contains another session's commit is NOT caught at push.
# It is caught earlier, when that other session tried to commit into the tree.
# Work committed before any claim existed is not caught at all. Do not read the
# two hooks as two independent layers over the same direction; they are not.
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
# A claim is stale — and is taken over with a warning, never a refusal — when
# the process that made it is gone, or when it is old (see STALE_SECONDS and
# SOFT_STALE_SECONDS). A crashed or restarted session must never lock the tree.
#
# IT ONLY BITES WHEN BOTH SIDES HAVE A REAL IDENTITY. A session token comes
# from the environment; when this session or the claiming session had no
# reliable identity, the guard degrades to a warning and returns 0. A plain
# `git commit` by a human with no Claude environment must never be refused:
# git spawns a fresh hook process per commit, so a pid-derived token differs
# every time and would make a lone developer foreign to themselves.
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

STALE_SECONDS=28800        # 8h — hard cap, even for a provably running session
SOFT_STALE_SECONDS=7200    # 2h — cap when the claiming process cannot be found

TAG='[session-guard]'

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

# 0 = running, 1 = gone, 2 = cannot tell.
#
# CLAUDE_PID is a WINDOWS pid, which is the WINPID column of MSYS `ps`, not the
# MSYS pid in /proc. So check /proc, then both pid columns of `ps`, and only
# then conclude "gone". Concluding "gone" from an empty or failed `ps` would
# silently hand a live session's tree to another session, so an empty listing
# is "cannot tell", not "gone".
pid_alive() {
  _p="$1"
  case "$_p" in '' | 0 | *[!0-9]*) return 2 ;; esac
  [ -d "/proc/$_p" ] && return 0
  if command -v ps >/dev/null 2>&1; then
    _ps="$(ps -W 2>/dev/null)"
    [ -n "$_ps" ] || _ps="$(ps 2>/dev/null)"
    if [ -n "$_ps" ]; then
      printf '%s\n' "$_ps" | awk '{ print $1; print $4 }' | grep -qx "$_p" && return 0
      return 1
    fi
  fi
  kill -0 "$_p" 2>/dev/null && return 0
  return 2
}

# The session token must be computable INDEPENDENTLY by every hook process —
# a hook cannot ask the session who it is, it can only inherit environment.
# Precedence, most reliable first:
#   1. EQUORIA_SESSION_ID     — explicit, set by a human or a wrapper.
#   2. CLAUDE_CODE_SESSION_ID — exported by Claude Code into every tool process,
#      git hooks included (verified 2026-09-15 on 2.1.270). Shared by a session
#      and its subagents, which is correct: one session and its agents are one
#      owner of one tree.
#   3. CLAUDE_PID — the Claude process itself, stable for the life of the
#      session and therefore a usable identity.
#   4. parent pid + start time — NOT an identity. The parent of a hook is the
#      hook process git spawned for THIS commit, so the token changes on every
#      invocation and a lone developer would be foreign to themselves. It is
#      recorded as a weak token and the guard refuses nothing while it is in
#      play.
session_id() {
  if [ -n "${EQUORIA_SESSION_ID:-}" ]; then
    printf 'env:%s' "$EQUORIA_SESSION_ID"
  elif [ -n "${CLAUDE_CODE_SESSION_ID:-}" ]; then
    printf 'cc:%s' "$CLAUDE_CODE_SESSION_ID"
  elif [ -n "${CLAUDE_PID:-}" ]; then
    printf 'claudepid:%s' "$CLAUDE_PID"
  else
    printf 'pid:%s.%s' "$PPID" "$(proc_start "$PPID")"
  fi
}

session_id_is_weak() {
  [ -z "${EQUORIA_SESSION_ID:-}" ] &&
    [ -z "${CLAUDE_CODE_SESSION_ID:-}" ] &&
    [ -z "${CLAUDE_PID:-}" ]
}

session_pid() {
  printf '%s' "${CLAUDE_PID:-}"
}

# Resolved ONCE at startup: every field read used to spawn its own
# `git rev-parse`, and process creation is the dominant cost on Windows.
GIT_DIR_PATH="$(git rev-parse --git-dir 2>/dev/null || true)"
STATE_FILE="${GIT_DIR_PATH:+$GIT_DIR_PATH/equoria-session.json}"

state_file() {
  [ -n "$STATE_FILE" ] || return 1
  printf '%s' "$STATE_FILE"
}

# ------------------------------------------------------------------ git facts

# One path per line, EXACTLY as git records it: core.quotePath=false plus -z
# means no octal escapes, no surrounding quotes, and no shell-visible
# difference between the two sides of the comparison. (A snapshot path escaped
# one way and a staged path escaped another made a file look foreign to its own
# session.) A rename record is "XY new" followed by a separate record holding
# the old path; the destination is what a later commit stages, so keep it and
# skip the one that follows.
dirty_paths() {
  git -c core.quotePath=false status --porcelain -z 2>/dev/null |
    tr '\0' '\n' |
    awk 'skip { skip = 0; next }
         { s = substr($0, 1, 2); if (s ~ /^[RC]/) skip = 1; print substr($0, 4) }'
}

staged_paths() {
  git -c core.quotePath=false diff --cached --name-only -z 2>/dev/null |
    tr '\0' '\n'
}

# ------------------------------------------------------------- state file i/o

json_escape() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

json_unescape() {
  sed -e 's/\\"/"/g' -e 's/\\\\/\\/g'
}

write_claim() {
  _sf="$STATE_FILE"
  [ -n "$_sf" ] || return 1
  _sid="$1"
  _weak=false
  session_id_is_weak && _weak=true
  {
    printf '{\n'
    printf '  "schema": 2,\n'
    printf '  "session": "%s",\n' "$(printf '%s' "$_sid" | json_escape)"
    printf '  "weak": %s,\n' "$_weak"
    printf '  "pid": "%s",\n' "$(session_pid)"
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
  # Scalar field out of the one-key-per-line JSON we write ourselves, in a
  # single process. Strip the trailing comma FIRST: a value read as
  # "1789442012," is not a number, and a claim whose age silently parsed as 0
  # would never be seen as stale.
  [ -n "$STATE_FILE" ] || return 0
  awk -v k="  \"$1\": " '
    index($0, k) == 1 {
      v = substr($0, length(k) + 1)
      sub(/,$/, "", v)
      sub(/^"/, "", v)
      sub(/"$/, "", v)
      print v
      exit
    }' "$STATE_FILE" 2>/dev/null
}

claim_dirty_to() {
  sed -n '/^  "dirty": \[/,/^  \]/p' "$STATE_FILE" 2>/dev/null |
    sed -e '1d' -e '$d' -e 's|^    "||' -e 's|",\{0,1\}$||' |
    json_unescape > "$1"
}

# A claim we cannot read is not a claim. Refusing on behalf of a session we
# cannot name produces "claiming session : (age 0m)", which is worse than not
# checking at all.
claim_valid() {
  [ -n "$STATE_FILE" ] || return 1
  [ -s "$STATE_FILE" ] || return 1
  [ -n "$(claim_field session)" ] || return 1
  _at="$(claim_field claimed_at)"
  case "$_at" in '' | *[!0-9]*) return 1 ;; esac
  return 0
}

claim_age_seconds() {
  _at="$(claim_field claimed_at)"
  case "$_at" in '' | *[!0-9]*) printf '0'; return ;; esac
  printf '%s' "$(( $(date +%s) - _at ))"
}

# Prints a reason when the claim should be taken over; prints nothing when the
# claim still stands.
claim_stale_reason() {
  _age="$1"
  _cpid="$(claim_field pid)"
  pid_alive "$_cpid"
  _live=$?
  if [ "$_live" -eq 1 ]; then
    printf 'the claiming process (pid %s) is no longer running' "$_cpid"
    return
  fi
  if [ "$_live" -eq 0 ]; then
    [ "$_age" -ge "$STALE_SECONDS" ] &&
      printf 'the claim is older than %dh' "$(( STALE_SECONDS / 3600 ))"
    return
  fi
  # Liveness unknown: a shorter window, because "old" is the only evidence left.
  [ "$_age" -ge "$SOFT_STALE_SECONDS" ] &&
    printf 'the claim is older than %dh and its session cannot be shown to be running' \
      "$(( SOFT_STALE_SECONDS / 3600 ))"
}

human_age() {
  _s="$1"
  if [ "$_s" -lt 3600 ]; then printf '%dm' "$(( _s / 60 ))"
  else printf '%dh%dm' "$(( _s / 3600 ))" "$(( (_s % 3600) / 60 ))"; fi
}

override_hint() {
  echo "$TAG   If you are certain this is your own work, re-run with" >&2
  echo "$TAG   EQUORIA_SESSION_OVERRIDE=1. Otherwise the safe move is a" >&2
  echo "$TAG   dedicated worktree: git worktree add ../<name> -b <branch>" >&2
}

warn_unreadable() {
  echo "$TAG WARNING: the claim file could not be read and was rewritten:" >&2
  echo "$TAG   $(state_file)" >&2
  echo "$TAG   Delete that file to reset the guard; nothing else depends on it." >&2
}

warn_weak() {
  echo "$TAG advisory only ($1): no EQUORIA_SESSION_ID or CLAUDE_CODE_SESSION_ID" >&2
  echo "$TAG   in this environment, so this session has no stable identity and the" >&2
  echo "$TAG   guard will not refuse anything. Export EQUORIA_SESSION_ID to arm it." >&2
}

# ------------------------------------------------------------------ claim cmd

cmd_claim() {
  if in_ci; then return 0; fi
  _me="$(session_id)"

  if claim_valid; then
    _owner="$(claim_field session)"
    _age="$(claim_age_seconds)"

    if [ "$_owner" = "$_me" ]; then
      write_claim "$_me"
      echo "$TAG checkout re-claimed by this session ($_me)."
      return 0
    fi

    if [ "$(claim_field weak)" = "true" ]; then
      write_claim "$_me"
      echo "$TAG took over a claim that had no stable identity (previous token: $_owner)."
      return 0
    fi

    _stale="$(claim_stale_reason "$_age")"
    if [ -n "$_stale" ]; then
      echo "$TAG WARNING: taking over a STALE claim — $_stale."
      echo "$TAG   previous session: $_owner (age $(human_age "$_age"))"
      echo "$TAG   If that session is still running, STOP and use a worktree."
      write_claim "$_me"
      return 0
    fi

    echo "$TAG ANOTHER LIVE SESSION HOLDS THIS CHECKOUT."
    echo "$TAG   session : $_owner"
    echo "$TAG   age     : $(human_age "$_age")"
    echo "$TAG   branch  : $(claim_field branch)"
    echo "$TAG   head    : $(claim_field head)"
    echo "$TAG   Its uncommitted work is in the tree you are about to edit."
    echo "$TAG   A reset, checkout, stash or branch move here destroys it."
    echo "$TAG   Work in your own worktree instead:"
    echo "$TAG     git worktree add ../equoria-<task> -b <branch>"
    echo "$TAG   The claim was NOT taken over; commits from here will be refused."
    return 0
  fi

  [ -f "$STATE_FILE" ] && warn_unreadable
  write_claim "$_me"
  echo "$TAG checkout claimed by this session ($_me)."
  if session_id_is_weak; then
    echo "$TAG   NOTE: no EQUORIA_SESSION_ID or CLAUDE_CODE_SESSION_ID in the"
    echo "$TAG   environment. The token falls back to a parent pid, which changes"
    echo "$TAG   on every hook run, so the guard is ADVISORY here: it will warn"
    echo "$TAG   and never refuse. Export EQUORIA_SESSION_ID to arm it."
  fi
  return 0
}

# -------------------------------------------------------------- precommit cmd

cmd_precommit() {
  if in_ci; then return 0; fi
  _me="$(session_id)"

  # No readable claim: claim it and proceed. The first commit in a checkout is
  # never the suspicious one, and an unreadable file names nobody.
  if ! claim_valid; then
    [ -f "$STATE_FILE" ] && warn_unreadable
    write_claim "$_me"
    return 0
  fi

  _owner="$(claim_field session)"
  _age="$(claim_age_seconds)"

  if [ "$_owner" = "$_me" ]; then
    write_claim "$_me"   # refresh: branch, head and dirty set move as I work
    return 0
  fi

  # The claim was made without a stable identity, so a different token proves
  # nothing. Refresh it and say so in one line rather than refusing a lone
  # developer's second commit.
  if [ "$(claim_field weak)" = "true" ]; then
    if session_id_is_weak; then
      echo "$TAG advisory only: no session identity in the environment (set" >&2
      echo "$TAG   EQUORIA_SESSION_ID to enable cross-session refusal)." >&2
    else
      echo "$TAG took over a claim that had no stable identity ($_owner)." >&2
    fi
    write_claim "$_me"
    return 0
  fi

  # A strong claim, but this side cannot name itself: warn, never refuse.
  if session_id_is_weak; then
    warn_weak "commit"
    echo "$TAG   This checkout is claimed by $_owner (age $(human_age "$_age"))." >&2
    return 0
  fi

  _stale="$(claim_stale_reason "$_age")"
  if [ -n "$_stale" ]; then
    echo "$TAG WARNING: taking over session $_owner's claim — $_stale." >&2
    write_claim "$_me"
    return 0
  fi

  # The incident's shape: a session that does not own the tree commits its OWN
  # new work into it, and that commit becomes an ancestor of the owner's branch
  # tip. So the signal is staged paths the claiming session's snapshot did not
  # contain.
  _snap="$STATE_FILE.snap$$"
  claim_dirty_to "$_snap"
  _foreign="$(staged_paths | grep -Fxv -f "$_snap" || true)"
  _overlap="$(staged_paths | grep -Fx -f "$_snap" || true)"
  rm -f "$_snap"

  if [ -z "$_foreign" ]; then
    if [ -n "$_overlap" ]; then
      echo "$TAG WARNING: session $_owner claimed this checkout and every" >&2
      echo "$TAG   staged path was already dirty in ITS snapshot:" >&2
      printf '%s\n' "$_overlap" | sed "s|^|$TAG     |" >&2
      echo "$TAG   You may be committing that session's uncommitted work." >&2
    fi
    return 0
  fi

  if overridden; then
    echo "$TAG OVERRIDE: committing over session $_owner's claim on this checkout." >&2
    write_claim "$_me"
    return 0
  fi

  echo "" >&2
  echo "$TAG REFUSING THE COMMIT — this checkout belongs to another session." >&2
  echo "$TAG   claiming session : $_owner (age $(human_age "$_age"))" >&2
  echo "$TAG   this session     : $_me" >&2
  echo "$TAG   claimed branch   : $(claim_field branch)" >&2
  echo "$TAG" >&2
  echo "$TAG   Staged paths that were NOT in that session's snapshot:" >&2
  printf '%s\n' "$_foreign" | sed "s|^|$TAG     |" >&2
  if [ -n "$_overlap" ]; then
    echo "$TAG   Also staged, and already dirty for that session:" >&2
    printf '%s\n' "$_overlap" | sed "s|^|$TAG     |" >&2
  fi
  echo "$TAG" >&2
  echo "$TAG   Committing here puts your work on the branch the other session" >&2
  echo "$TAG   is about to push, under a message describing something else." >&2
  override_hint
  echo "" >&2
  return 1
}

# ---------------------------------------------------------------- prepush cmd

# git feeds a pre-push hook one line per ref on stdin:
#   <local ref> <local sha> <remote ref> <remote sha>
# Judge exactly what is being pushed rather than assuming @{upstream}..HEAD: a
# tag or a side branch is otherwise measured against the wrong commits. With no
# stdin (a manual run) fall back to the upstream range.
#
# NOTE: this consumes the hook's stdin. Nothing else in .husky/pre-push reads
# it; if that changes, tee it there.
push_commits_to() {
  _out="$1"
  : > "$_out"
  _got=0
  if [ ! -t 0 ]; then
    while read -r _lref _lsha _rref _rsha; do
      [ -n "${_lsha:-}" ] || continue
      case "$_lsha" in *[!0]*) ;; *) continue ;; esac   # all zeros: a deletion
      case "${_rsha:-}" in
        *[!0]*) git rev-list "$_rsha..$_lsha" 2>/dev/null >> "$_out" ;;
        *)      git rev-list "$_lsha" --not --remotes 2>/dev/null >> "$_out" ;;
      esac
      _got=1
    done
  fi
  if [ "$_got" -eq 0 ]; then
    _up="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
    if [ -z "$_up" ]; then
      echo "$TAG no upstream and no refs on stdin — cross-session push check skipped."
      return 1
    fi
    git rev-list "$_up..HEAD" 2>/dev/null >> "$_out"
  fi
  sort -u "$_out" -o "$_out"
  return 0
}

cmd_prepush() {
  if in_ci; then return 0; fi
  _me="$(session_id)"

  if ! claim_valid; then
    [ -f "$STATE_FILE" ] && warn_unreadable
    return 0
  fi

  _shas="$STATE_FILE.push$$"
  if ! push_commits_to "$_shas"; then
    rm -f "$_shas"
    return 0
  fi
  _count="$(grep -c . "$_shas" || true)"
  if [ "$_count" -eq 0 ]; then
    rm -f "$_shas"
    return 0
  fi

  _npairs="$(git log --no-walk --stdin --format='%ae|%ce' < "$_shas" 2>/dev/null | sort -u | grep -c . || true)"
  _owner="$(claim_field session)"
  _age="$(claim_age_seconds)"

  _foreign_paths=""
  _reason=""

  if [ "$_owner" != "$_me" ] &&
     [ "$(claim_field weak)" != "true" ] &&
     ! session_id_is_weak &&
     [ -z "$(claim_stale_reason "$_age")" ]; then
    # A live, identified, foreign claim. Evidence — not the mere existence of
    # unpushed commits — decides: commits touching paths the claiming session
    # never had dirty, or more than one author/committer identity. Identity
    # alone is not enough here, because every session commits as the same git
    # user; that is why the path evidence exists.
    _snap="$STATE_FILE.snap$$"
    claim_dirty_to "$_snap"
    _foreign_paths="$(git log --no-walk --stdin --format= --name-only < "$_shas" 2>/dev/null |
      grep . | sort -u | grep -Fxv -f "$_snap" || true)"
    rm -f "$_snap"
    if [ -n "$_foreign_paths" ]; then
      _reason="this checkout is claimed by another live session and the push carries $_count commit(s) touching paths that session never had dirty"
    elif [ "$_npairs" -gt 1 ]; then
      _reason="the push mixes $_npairs author/committer identities and this session does not hold the claim"
    fi
  elif [ "$_npairs" -gt 1 ]; then
    _reason="the push carries $_npairs distinct author/committer identities"
  fi

  if [ -z "$_reason" ]; then
    rm -f "$_shas"
    return 0
  fi

  # Weak identity never refuses — it cannot tell itself apart from anyone.
  if session_id_is_weak; then
    echo "$TAG WARNING: $_reason." >&2
    warn_weak "push"
    rm -f "$_shas"
    return 0
  fi

  if overridden; then
    echo "$TAG OVERRIDE: pushing anyway — $_reason." >&2
    rm -f "$_shas"
    return 0
  fi

  echo "" >&2
  echo "$TAG REFUSING THE PUSH — $_reason." >&2
  echo "$TAG   claiming session : $_owner (age $(human_age "$_age"))" >&2
  echo "$TAG   this session     : $_me" >&2
  echo "$TAG   commits          : $_count" >&2
  echo "$TAG" >&2
  echo "$TAG   Commits that would be pushed:" >&2
  git log --no-walk --stdin --format='%h %an <%ae> %ad %s' --date=short < "$_shas" 2>/dev/null |
    sed "s|^|$TAG     |" >&2
  if [ -n "$_foreign_paths" ]; then
    echo "$TAG   Paths in those commits that the claiming session never had dirty:" >&2
    printf '%s\n' "$_foreign_paths" | head -20 | sed "s|^|$TAG     |" >&2
  fi
  echo "$TAG" >&2
  echo "$TAG   Read that list before overriding: a commit you did not make" >&2
  echo "$TAG   inside it is another session's unfinished work." >&2
  override_hint
  echo "" >&2
  rm -f "$_shas"
  return 1
}

# ----------------------------------------------------------------- status cmd

cmd_status() {
  if ! claim_valid; then
    if [ -f "$(state_file)" ]; then
      echo "$TAG claim file present but unreadable: $(state_file)"
      echo "$TAG   Delete it to reset the guard."
    else
      echo "$TAG no claim on this checkout ($(state_file))."
    fi
    return 0
  fi
  _mine=no
  [ "$(claim_field session)" = "$(session_id)" ] && _mine=yes
  _age="$(claim_age_seconds)"
  _stale="$(claim_stale_reason "$_age")"
  echo "$TAG claim: $(claim_field session)"
  echo "$TAG   age    : $(human_age "$_age")"
  echo "$TAG   branch : $(claim_field branch)"
  echo "$TAG   head   : $(claim_field head)"
  echo "$TAG   pid    : $(claim_field pid)"
  echo "$TAG   weak   : $(claim_field weak)"
  echo "$TAG   mine   : $_mine"
  echo "$TAG   stale  : ${_stale:-no}"
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
