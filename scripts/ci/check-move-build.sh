#!/usr/bin/env bash
# Compile every module-declaring ```move block in skills/ and rules/ with the real Move
# compiler. See scripts/ci/move-build/check-move-build.mjs for selection and baseline rules.
#
# Needs `sui` on PATH at the version this repo is pinned to (the gate refuses to run against a
# different one). Install with: suiup install sui@mainnet-v<version from README>.
#
# The framework sources are fetched once into a cache dir as a sparse checkout at the pinned tag
# (~9 MB). Without it the Move CLI's implicit dependency clones all of MystenLabs/sui into
# ~/.move — ~284 MB per revision, re-downloaded on every cold CI runner.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TAG=$(node -p "require('$HERE/move-symbols/index.json').tag")
CACHE_ROOT="${SUI_DEV_AGENTS_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/sui-dev-agents}"
FW="$CACHE_ROOT/framework-$TAG"

# Populated in a private directory and published with a single rename, and never deleted in
# place: `rm -rf "$FW"` could remove the tree a concurrently running gate is compiling against
# (the loser of the race re-checks the marker, still sees none, and deletes what the winner just
# published). Publishing is therefore attempted only when nothing is there, and a run that loses
# the race simply compiles against its own copy.
FW_USE="$FW"
CLEANUP=""
if [ ! -f "$FW/.complete" ]; then
  mkdir -p "$CACHE_ROOT"
  TMP="$FW.tmp.$$"
  rm -rf "$TMP"
  trap 'rm -rf "$TMP"' EXIT
  git clone --quiet --filter=blob:none --no-checkout --depth 1 --branch "$TAG" \
    https://github.com/MystenLabs/sui.git "$TMP"
  git -C "$TMP" sparse-checkout set --cone crates/sui-framework/packages
  git -C "$TMP" checkout --quiet
  touch "$TMP/.complete"
  # `mv` onto a name nothing occupies is atomic; if anything is already there — a complete tree
  # from a parallel run, or an abandoned partial one — leave it alone and use our own copy.
  if [ ! -e "$FW" ] && mv "$TMP" "$FW" 2>/dev/null; then
    trap - EXIT
  else
    FW_USE="$TMP"
    CLEANUP="$TMP"
    trap - EXIT
  fi
fi

# Not `exec`: the temporary checkout (when we lost the publish race) has to outlive the compile
# and be removed afterwards. The caller's own flags go first so an explicit --framework wins over
# the default appended here — arg() takes the first occurrence.
# `rc=0; … || rc=$?` and not `…; rc=$?`: under `set -e` a failing node exits the script at that
# command, so the cleanup below would never run on precisely the red runs it matters for.
rc=0
node "$HERE/move-build/check-move-build.mjs" "$@" --framework "$FW_USE" || rc=$?
if [ -n "$CLEANUP" ]; then rm -rf "$CLEANUP"; fi
exit $rc
