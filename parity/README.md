# Parity harness

Checks that what we build behaves like FreeShow. Plan:
[`docs/parity-workflow.md`](../docs/parity-workflow.md).

Status: **structure only.** Calibration has run; no adapter is implemented.

```
features/     one YAML per feature, with reference evidence and confidence
scenarios/    operator-level steps, shared by both adapters
fixtures/     input files (FreeShow .show for now, .cjcp later)
tools/        capture and comparison scripts (Node)
reports/      evidence: preflight, calibration, experiment runs
```

## What has been established

| Result | Where |
| --- | --- |
| FreeShow's web clients run and can be driven by Playwright | `reports/preflight-2026-11-09.md` |
| Navigation lives on the controller (5512), not the remote | same |
| Static Chromium captures are bit-identical across runs | `reports/calibration-2026-11-09.md` |
| Four-window state recovery works in our app | `reports/experiment-1-2026-11-09.md` |

## Running the reference

```bash
# 1. FreeShow must be built and running with a scratch profile
cd ~/projects/reference/freeshow
FS_MOCK_STORE_PATH=/tmp/opencode/fs-store NODE_ENV=production npx electron . \
  --user-data-dir=/tmp/opencode/fs-userdata

# 2. Capture
cd parity/tools
npm install
node capture_freeshow.mjs /tmp/parity-capture
```

The scratch profile needs:

- `config.json` with `dataPath` pointing at a scratch folder;
- `settings.json` with every server explicitly enabled —
  `disabledServers: { remote: false, stage: false, controller: false, output_stream: false }`,
  because a server starts only when its value is exactly `false`;
- `projects.json` listing the fixture project;
- `<dataPath>/Shows/<name>.show` holding `[id, show]` JSON with a real layout.

## Not built yet

- `tools/run.mjs` — the runner and gate.
- `adapters/freeshow` — Playwright Electron, main-window DOM as the oracle.
- `adapters/cjcrsg` — headless Chromium against the renderer web build.
- `fixtures/parity-three-slides.show` — the scenario refers to it; it still
  lives only in the scratch profile.
