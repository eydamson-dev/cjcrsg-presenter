# Implementation evidence — DEV-015, next at the end of a show

- **Contract:** `docs/contracts/nav-next-at-end.md`
- **Feature:** `nav.bounds.next-at-end`
- **Reference:** `docs/freeshow-reference/show/presenting.md` § End of show —
  observed; `parity/reports/reader/next-at-end-2026-11-09.md`
- **Candidate:** the commit that adds this directory; its SHA is reported in the
  hand-off to the verifier. The commit message names this evidence.
- **Measured:** 2026-11-09, on `dev-015-next-at-end`

## What was run

1. `scripts/check.sh` bare — exit code and output are recorded in the final
   answer and in `test-output.txt` (the `cargo test --workspace` half).
2. The desktop app in a real X11 window:
   `GDK_BACKEND=x11 CJCRSG_DATA_DIR=… CJCRSG_PROJECT=… CJCRSG_REMOTE_PORT=5531
   ./target/debug/cjcrsg-presenter`, with the 1280×820 window from the app's own
   `Config`. Captures through `scripts/capture_window.sh "CJCRSG Presenter"`.
3. Next was driven through the desktop app's own remote server, which is the
   same `SharedEngine` the windows use: `curl -X POST
   http://127.0.0.1:5531/api/next`. State was read back from `/api/state`.

The fixture is two one-slide shows, Welcome then Parity Fixture, each under a
section heading: `next-at-end.cjcp` in this directory.

## Result

| Step | `/api/state` | Window |
| --- | --- | --- |
| start, fresh session | `rev 0`, `welcome-1`, `1 / 2` | `controller-at-end-on-1280x820.png`: control reads **At end: advance**; Welcome is `LIVE`; Parity Fixture has no badge |
| one Next | `rev 1`, `welcome-1`, `1 / 2`; `next` = Parity Fixture text | `outline-after-first-press-1280x820.png`: output and preview unchanged; Parity Fixture is `SELECTED` |
| second Next | `rev 2`, `fixture-1`, `2 / 2` | `outline-after-second-press-1280x820.png`: Parity Fixture is `LIVE`, Welcome has no badge |
| click control → off | session file `next_item_on_last_slide: false` | `controller-at-end-off-1280x820.png`: control reads **At end: stop** |
| two Next presses, setting off | `rev 0`, `welcome-1`, `1 / 2` both times | `outline-setting-off-next-noop-1280x820.png` |
| restart with that session | `rev 0`, `welcome-1`, `1 / 2` after Next | `controller-at-end-off-after-restart-1280x820.png`: still **At end: stop** |
| fresh session, focus mode, one Next | `rev 1`, `welcome-1`, `1 / 2` | `focus-after-first-press-1280x820.png`: Welcome `LIVE`, Parity Fixture `SELECTED` |

The first press returns `true` and publishes revision 1 with no transition (the
slide and its media are unchanged); the second publishes revision 2 as an
ordinary advance. The controller's preview and the `LIVE` badge stay on the old
show after the first press, which is what makes the move visible in the
selected row.

The result table above is the `/api/state` read-back at each step; the
`run-*.txt` files beside `test-output.txt` are the app's own stdout for the
click-and-off and restart runs (project loaded, remote listening, no warnings or
errors), kept so the screenshots can be tied to a session.

## Session files

- `session-on.json` — written by a fresh launch (`record` on open), default true.
- `session-off.json` — after the control was clicked to off.

Both were copied from the app's data directory; nothing was hand-edited.

## How the off state was reached

A synthetic X11 click does not reach the XWayland WebView (AGENTS trap). The app
already carries a debug-only evidence hook for exactly this
(`CJCRSG_DRAWER`): it dispatches a real DOM click through the operator handler.
This milestone adds the `at-end` step to that hook and uses it once:
`CJCRSG_DRAWER=at-end`. It is compiled only in debug builds and is not on any
presentation path. The restart capture is the ordinary startup path: it reads
the session file in `AppState::new` and applies it to the engine before the
first render.

## Tests

`cargo test --workspace` — 195 passed, 0 failed. The contract's six tests, plus
two engine tests for the setting and the empty case, one session-default test,
one session round-trip test and one control-wording test:

- `engine::tests::next_at_show_end_selects_then_plays`
- `engine::tests::next_at_show_end_setting_off_is_no_op`
- `engine::tests::next_at_project_end_is_no_op`
- `engine::tests::next_within_show_is_unchanged`
- `engine::tests::selection_follows_go_to_and_first_last`
- `engine::tests::replace_project_resets_selection`
- `engine::tests::changing_the_end_of_show_setting_does_not_move_anything`
- `engine::tests::selection_starts_on_the_first_show_with_a_slide`

The updated rather than deleted tests are `next_advances_and_increments_revision`
and `next_at_the_end_is_a_no_op`; both now expect the two-press model.

## What is not claimed

- No output-window capture is included. The `/api/state` response and the
  controller's live preview show the output slide did not change on the first
  press; the acceptance evidence asked for the outline capture, not an output
  window.
- No verifier pass. This is a candidate for verification, not an accepted
  milestone.
