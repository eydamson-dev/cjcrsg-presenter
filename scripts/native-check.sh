#!/usr/bin/env bash
# Native smoke: run Experiment 1 inside a hidden agent desktop.
#
# This is the native-layer equivalent of scripts/check.sh. It builds the app,
# starts an agent workspace, runs CJCRSG_SMOKE=1 in it, prints the report and
# returns the app's exit code. See docs/agent-workspace.md.
#
# Usage: scripts/native-check.sh
#
# Environment:
#   AGENT_WORKSPACE_BIN=agent-workspace-linux  binary to use
#   CJCRSG_NATIVE_SESSION=x11                  x11 or kwin
#   CJCRSG_NATIVE_WORKSPACE=cjcrsg-native-check workspace id
#   CJCRSG_NATIVE_NO_BUILD=1                   skip the cargo build
#   CJCRSG_SMOKE_OUT=/path/report.json         where the report is written
#
# It is Linux-only and needs Xvfb + openbox. It proves nothing about Windows.
set -euo pipefail

cd "$(dirname "$0")/.."

bin=${AGENT_WORKSPACE_BIN:-agent-workspace-linux}
session=${CJCRSG_NATIVE_SESSION:-x11}
workspace=${CJCRSG_NATIVE_WORKSPACE:-cjcrsg-native-check}
smoke_out=${CJCRSG_SMOKE_OUT:-${TMPDIR:-/tmp}/cjcrsg-native-smoke.json}
port=${CJCRSG_NATIVE_PORT:-5549}

if ! command -v "$bin" >/dev/null 2>&1; then
    echo "native-check: '$bin' not found on PATH." >&2
    echo "native-check: install it and the packages first — see docs/agent-workspace.md." >&2
    exit 127
fi

ready=$("$bin" doctor 2>/dev/null |
    python3 -c 'import json,sys; print(json.load(sys.stdin).get("ready_for_x11_workspace", False))')
if [ "$ready" != "True" ]; then
    echo "native-check: the workspace runtime is not ready; run '$bin doctor'." >&2
    exit 127
fi

if [ "${CJCRSG_NATIVE_NO_BUILD:-0}" != "1" ]; then
    echo "== build =="
    cargo build -p cjcrsg-presenter
fi

# Always tear the workspace down, including on failure.
cleanup() {
    "$bin" workspace stop --id "$workspace" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "== start ($session) =="
"$bin" workspace start --ack-hidden-workspace --session "$session" \
    --width 1920 --height 1080 --id "$workspace" \
    --purpose "native check" >/dev/null

env_args=(--env CJCRSG_SMOKE=1 --env "CJCRSG_SMOKE_OUT=$smoke_out" --env "CJCRSG_REMOTE_PORT=$port")
if [ "$session" = "x11" ]; then
    env_args+=(--env GDK_BACKEND=x11)
fi

echo "== smoke =="
result=$("$bin" workspace run --id "$workspace" --cwd "$PWD" \
    "${env_args[@]}" -- ./target/debug/cjcrsg-presenter)

exit_code=$(printf '%s' "$result" | python3 -c '
import json, sys
data = json.load(sys.stdin)
if isinstance(data.get("exit_code"), int):
    print(data["exit_code"])
else:
    apps = data.get("apps") or [{}]
    code = apps[0].get("exit_code")
    print(code if isinstance(code, int) else "unknown")
')

printf '%s' "$result" | python3 -c '
import json, sys
data = json.load(sys.stdin)
out = (data.get("stdout") or {}).get("content", "")
start = out.find("--- SMOKE REPORT ---")
print(out[start:].split("--- END ---")[0].rstrip() if start >= 0 else out[-600:].rstrip())
'

echo
echo "report: $smoke_out"

# The report is the verdict. An exit code alone cannot tell a crashed run from
# a failing check, and the runner's JSON does not always carry one.
passed=$(python3 - "$smoke_out" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as handle:
        print("true" if json.load(handle).get("passed") is True else "false")
except OSError:
    print("missing")
except ValueError:
    print("unreadable")
PY
)

case "$passed" in
    true)
        echo "native-check: pass"
        exit 0
        ;;
    *)
        echo "native-check: FAIL (report=$passed, app exit=$exit_code)"
        exit 1
        ;;
esac

