# Driving the real app in an agent workspace

`agent-workspace-linux` gives an agent its own hidden Linux desktop and exposes
it over MCP: screenshots, pointer, keyboard, windows, clipboard and a terminal.
It is **not** a sandbox — apps run as you, with your files and network.

This page says what it is good for here, how to run it, and where it lies.

## What it can and cannot prove

| Question | Answer |
| --- | --- |
| Does the real Dioxus/WebKitGTK app launch and render? | Yes — verified by screenshot |
| Can we click and type into the WebView? | Yes — engine revision advances |
| Do multiple native windows work? | Yes — controller + four outputs |
| Does output recovery behave? | Yes — `CJCRSG_SMOKE` passes, 303 ms |
| Does it prove Windows/WebView2? | **No.** Separate Windows environment only |
| Multi-monitor, monitor hotplug, `set_fullscreen()` selection | **No.** One output per workspace |
| Wayland-native client paths | **No** on the X11 backend (`GDK_BACKEND=x11`) |
| GPU/video performance, hardware decode | **No.** Xvfb renders through llvmpipe |

Linux desktop evidence is never Windows evidence. Do not let a green run here
stand in for `docs/windows.md`.

## Setup on this machine

Installed once:

```bash
sudo dnf install -y xorg-x11-server-Xvfb openbox xdotool
install -m 0755 agent-workspace-linux-x86_64-unknown-linux-gnu ~/.local/bin/agent-workspace-linux
```

Registered in `~/.config/opencode/opencode.json` under `mcp.servers` as
`agent-workspace` (command `agent-workspace-linux mcp`). Code Mode keeps its 82
tools discoverable rather than preloaded.

The **KWin** backend also works with zero extra packages, but see the capture
trap below — prefer **X11** for this app.

## From OpenCode

The server is registered globally in `~/.config/opencode/opencode.json` as
`agent-workspace`, so every session has the tools without setup. Under Code Mode
they are `tools["agent-workspace"].workspace_*`, found with `search()` rather
than loaded up front.

Orientation before acting: `mcp_agent_context` gives one snapshot of running
workspaces, handles and viewer state.

`workspace_start` opens the GPUI viewer on the host by default. Pass
`open_viewer: false` when the run should stay invisible, and
`acknowledge_hidden_workspace: true` with a `purpose`, which the tool requires.

## Running it

```bash
agent-workspace-linux doctor                     # ready_for_x11_workspace must be true
agent-workspace-linux workspace start --ack-hidden-workspace --session x11 \
    --width 1920 --height 1080 --id cjx --purpose "cjcrsg QA"
agent-workspace-linux workspace launch --id cjx --name presenter \
    --cwd "$PWD" \
    --env GDK_BACKEND=x11 \
    --env CJCRSG_REMOTE_PORT=5532 \
    --wait-window --window-timeout-ms 30000 \
    -- ./target/debug/cjcrsg-presenter
agent-workspace-linux workspace screenshot --id cjx --output /tmp/ws.png
agent-workspace-linux viewer --id cjx            # watch / take over
agent-workspace-linux workspace stop --id cjx
```

Give every instance its own `CJCRSG_REMOTE_PORT`; the default 5520 is taken by
whatever else is running, and the second instance logs `Address already in
use` and continues without a remote.

Useful levers: `CJCRSG_DEMO_OPEN=all` opens all four outputs at start,
`CJCRSG_DATA_DIR` isolates session state, `CJCRSG_SMOKE=1` runs the milestone
smoke test.

The smoke test is the best single check that the native path works:

```bash
agent-workspace-linux workspace run --id cjx --cwd "$PWD" \
    --env GDK_BACKEND=x11 --env CJCRSG_SMOKE=1 \
    --env CJCRSG_SMOKE_OUT=/tmp/smoke.json -- ./target/debug/cjcrsg-presenter
```

## Traps

- **A window screenshot does not contain the WebView.** `workspace
  screenshot-window` (and KWin's per-window capture) returns the GTK parent
  surface, so the controller looks blank while the app is fine. Capture the
  **root** with `workspace screenshot` and crop.
- **The controller does not repaint on engine changes.** See the open defect
  below. Never trust a controller screenshot taken right after a programmatic
  action; drive the engine and read state from `/api/state`, or interact with
  the window first.
- **`pkill -f` matches its own shell.** Same trap as the root `AGENTS.md`.
  Use the workspace pid handles or a pid file.
- **Xvfb has no GPU.** stderr carries `MESA-EGL: DRI3 error`; that is expected.
  Do not read rendering speed or video smoothness off this environment.

## Open defect found this way

On 2026-11-10, driving the app in the workspace and then on the host showed the
same thing: **the controller window does not update when the engine changes
without a user interaction.**

Reproduction, on the host with `GDK_BACKEND=x11`:

```bash
GDK_BACKEND=x11 CJCRSG_REMOTE_PORT=5540 CJCRSG_DATA_DIR=/tmp/x \
    ./target/debug/cjcrsg-presenter &
curl -s -X POST http://127.0.0.1:5540/api/next    # 200, /api/state now revision 1
# wait 8 s, then capture the window: it still reads "rev 0 · 1 / 12"
```

Clicking a drawer tab makes it catch up — it then shows the current revision.
The intended mechanism is the 250 ms tick at `apps/desktop/src/app.rs:23-43`,
whose comment says that without it the UI "would only refresh on an
interaction"; the tick is not producing a repaint. No panic appears in the log,
so the timer future is not failing loudly.

Not yet diagnosed further: it needs either a log line inside the tick loop or a
check of whether the signal write reaches the renderer. It is reproducible with
a real GPU and on XWayland, so it is not an Xvfb artefact.
