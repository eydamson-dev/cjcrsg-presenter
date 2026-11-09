#!/usr/bin/env bash
# Everything CI should run. Fails on the first problem.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== fmt =="
cargo fmt --all --check

echo "== clippy =="
cargo clippy --workspace --all-targets -- -D warnings

echo "== tests =="
set +e
test_out=$(cargo test --workspace 2>&1)
status=$?
set -e
echo "$test_out" | grep -E "^(test result|running [0-9]+ tests)" || true
if [ "$status" -ne 0 ]; then
    echo "$test_out" | tail -40
    echo "tests failed"
    exit 1
fi

# EVIDENCE.md is hand-written; this keeps its declared count honest.
count=$(echo "$test_out" | grep -E "^test result: ok\. [0-9]+ passed" | awk '{s+=$4} END {print s+0}')
declared=$(grep -oE '<!-- tests: [0-9]+ -->' EVIDENCE.md | grep -oE '[0-9]+' | head -1)

if [ -z "$declared" ]; then
    echo "EVIDENCE.md is missing its <!-- tests: N --> marker"
    exit 1
fi
if [ "$count" != "$declared" ]; then
    echo "EVIDENCE.md declares $declared tests, the workspace has $count"
    echo "update the marker and the 'As of' line"
    exit 1
fi
echo "tests: $count (matches EVIDENCE.md)"

echo "all green"
