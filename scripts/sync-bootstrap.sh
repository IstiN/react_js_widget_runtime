#!/usr/bin/env bash
# Copy the two canonical bootstrap halves from the pinned js_widget_runtime
# into src/vendor/ and write the provenance line (plan 1.2). CI runs
# `scripts/sync-bootstrap.sh && git diff --exit-code` so a committed copy
# that drifted from its source fails.
set -euo pipefail

dir="${JSR_CONFORMANCE_DIR:-.conformance}"
src="$dir/js_widget_runtime/src"
out="$(dirname "$0")/../src/vendor"
lock="$(dirname "$0")/../conformance.lock"

mkdir -p "$out"
for name in bootstrap-runtime.js bootstrap-widget.js; do
  line="$(grep "IstiN/js_widget_runtime@" "$lock" | head -1)"
  repo="${line%%@*}"
  spec="${line%%:*}"
  sha="${spec#*@}"
  target="$out/$name"
  {
    echo "// Generated from ${repo}@${sha:0:7}:src/$name by scripts/sync-bootstrap.sh — do not edit"
    cat "$src/$name"
  } > "$target"
  echo "sync: $target"
done
