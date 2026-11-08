#!/usr/bin/env bash
# Everything CI should run. Fails on the first problem.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== fmt =="
cargo fmt --all --check

echo "== clippy =="
cargo clippy --workspace --all-targets -- -D warnings

echo "== tests =="
cargo test --workspace

echo "all green"
