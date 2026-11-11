# Driving the real desktop with computer-use-linux

`computer-use-linux` gives an agent structured control of the **user's real KDE
desktop** over MCP: AT-SPI accessibility trees, screenshots, compositor-aware
window targeting, and pointer/keyboard input. It is the sibling of
`agent-workspace-linux`, which owns a *separate hidden* desktop — see
[docs/agent-workspace.md](agent-workspace.md) for that one.

It is **not** a sandbox. Actions run as you, on the live desktop, with your
files, keyring and network. Treat a click here exactly like a click you made.
The on-screen indicator draws a click-through overlay so you can see the agent
work, and it hides itself before any screenshot is read.

## What it can and cannot prove

| Question | Answer |
| --- | --- |
| Real KDE apps (Brave, terminal, file manager, system dialogs) | Yes — semantic AT-SPI tree + screenshots |
| The presenter controller UI | **No.** WebKitGTK exposes only the top-level window to AT-SPI, not the internal DOM. Use `render` or the agent workspace for the WebView itself |
| Real desktop windows, focus, click/type/drag | Yes — KWin backend, uinput/portal input |
| Screenshot the real desktop | Portal route detected; unverified until the first real capture (it prompts for consent) |
| Windows/WebView2 | **No.** Linux desktop only |

## Setup on this machine

Installed once (2026-11-11): the three prebuilt release binaries, sha256
verified, into `~/.local/bin` (`computer-use-linux`, `-cosmic`, `-indicator`).
Then AT-SPI was enabled, which the tree needs:

```bash
computer-use-linux setup    # enables AT-SPI accessibility (done once, 2026-11-11)
```

Registered **globally** in `~/.config/opencode/opencode.json` as
`computer-use-linux` (command `~/.local/bin/computer-use-linux mcp`), unlike
`agent-workspace`, which is project-scoped. Every session has the tools without
per-project setup.

## Verify

```bash
computer-use-linux doctor | jq .readiness
```

On this machine (Fedora 44, KDE Wayland) all readiness flags are green after
`setup`: `can_build_accessibility_tree`, `can_query_windows`,
`can_focus_windows`, `can_send_development_input` all true, no blockers. The one
caveat is `screenshot_capture_status: "unverified"` — `doctor` never captures,
and the first real capture prompts via the portal.

Backends on this KDE Wayland session:

| Capability | Backend |
| --- | --- |
| Windows | KWin scripting (session bus) |
| Input | uinput absolute pointer + RemoteDesktop portal; xdotool/wtype fallbacks |
| Screenshots | Screenshot portal |
| Accessibility | AT-SPI |

## From OpenCode

The tools are `mcp_computer_use_linux_*` (under Code Mode, `search()` for the
exact paths). Begin every turn with `get_app_state` — it returns a screenshot
plus a compacted AT-SPI tree with stable `element_index` handles. Scope it to an
app or window (`app_name_or_bundle_identifier`, `window_id`, `pid`, `app_id`,
`wm_class`, `title`); an unscoped call returns the whole desktop tree and floods
context.

The loop is orient → act → verify:

1. `get_app_state` (or `list_windows` / `focused_window`) to orient.
2. `click` / `type_text` / `press_key` / `perform_action` / `set_value` to act,
   passing the `snapshot_id` from the tree you read.
3. `screenshot` / `get_app_state` (or `screenshot_after: true` on the acting
   call) to verify.

CLI equivalents for scripting:

```bash
computer-use-linux windows            # list windows
computer-use-linux state [APP_NAME]   # screenshot + tree summary
computer-use-linux screenshot         # JSON screenshot summary
```

## Traps

- **It drives the real desktop.** No isolation, no undo. Never act on the real
  desktop when the agent workspace would do — prefer isolation.
- **WebView apps are opaque to AT-SPI.** For the presenter's controller the tree
  stops at the window; click by coordinates, not semantics.
- **`run_shell` is disabled by default and should stay that way.** It grants an
  approved call the user's full shell authority. Never enable it without an
  explicit request.
- **The first screenshot prompts for consent.** `doctor` reports capture
  `unverified` until a real capture is confirmed.
- **Stale `element_index`.** Each new `get_app_state` replaces the cached tree;
  always pass the `snapshot_id` from the tree you read, or the server refuses a
  mismatched index rather than mis-clicking.
- **Apps running before `setup` keep an empty tree** until restarted; the setup
  report says `requires_target_app_restart: true`.
