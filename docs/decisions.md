# Decisions

Short records of choices that are expensive to reverse. Newest last.

## D1 — Dioxus, on a WebView

**Context.** The app is a presentation tool whose look comes from HTML/CSS.
Dioxus's own renderer (Blitz) is experimental.

**Decision.** Dioxus 0.7.10 desktop, webview renderer, pinned exactly.

**Consequences.** The slide renderer stays HTML/CSS, so FreeShow's visual
contract can be carried across. We take on a 0.x framework; the version is
pinned and desktop API use is kept at the edges.

## D2 — Slides lay out at 1920×1080 and scale

**Context.** The first renderer reflowed: font sizes in `vw`, layout recomputed
per window size. FreeShow's `Zoomed` component lays out at a base resolution and
scales with `min(w/1920, h/1080)`.

**Decision.** Lay out at a fixed 1920×1080 and scale with a `--slide-scale`
variable computed from the viewport. `calc()` cannot divide a length by a number
inside `scale()`, so the variable is set by script.

**Consequences.** Proportions are identical at every output size, and text
metrics match FreeShow. Measured: every text box within 0.15 px, 0.35% differing
pixels at 1080p (`parity/reports/experiment-2-2026-11-09.md`).

## D3 — One `VirtualDom` per output; the engine owns the show

**Decision.** Each output window is an independent `VirtualDom`. The engine is
behind an `Arc<SharedEngine>`, never owned by a window.

**Consequences.** A closed window loses nothing; reopening reconstructs from a
snapshot. Verified: 205 ms recovery (`parity/reports/experiment-1-2026-11-09.md`).

## D4 — Snapshots, not events

**Decision.** Outputs subscribe to a `tokio::sync::watch` of `RenderState`, and
state carries a monotonic revision. No per-output channel, no event replay.

**Consequences.** A late or restarted window needs only the newest value. The
renderer animates only when it already knew a previous revision, so reopening
never replays a transition the congregation saw.

## D5 — Native format: JSON first, zip later

**Decision.** `.cjcp` (project) and `.cjcs` (show) are versioned JSON envelopes.
A newer `format_version` is refused, unknown fields are preserved. A zip
container with bundled media is a later, additive change.

**Consequences.** Files are diffable and testable in git. Media stays referenced,
not embedded, until packaging.

## D6 — Media paths are relative and typed

**Decision.** A media asset carries `origin` (`bundled` | `external`). Bundled
paths are relative and may not escape the project root; external paths may be
absolute and are documented as non-portable. FreeShow imports therefore arrive
as `external`.

**Consequences.** Projects survive being moved. Media becomes portable through
`cjcrsg-presenter bundle`, which copies external files into `<root>/media` and
rewrites them to relative paths; there is no controller button for it yet.

## D7 — GPL-3.0, and stay there

**Decision.** The project is GPL-3.0-only, inherited from FreeShow. No clean-room
claim is made and relicensing is out of scope.

**Consequences.** Source must remain available to anyone receiving binaries.
See `docs/provenance.md`.

## D8 — Our own remote protocol, for now

**Decision.** The remote is JSON over HTTP on port 5520, with a small HTML page.
FreeShow's clients speak Socket.IO on 5510–5513.

**Consequences.** The command path is proved and testable without a browser, but
existing FreeShow remote clients will not talk to us. Socket.IO parity is a
separate milestone.

## D9 — Visual evidence comes from headless renders, not windows

**Context.** Capturing native windows on this Wayland session failed repeatedly:
focus cannot be taken by the app, nothing can capture by window id, and KWin
scripting raised the wrong window twice and captured unrelated work.

**Decision.** Render the real components to HTML with `dioxus-ssr` and screenshot
them in headless Chromium. Native-window behaviour is covered by measurements
(Experiment 1), not by screenshots.

**Consequences.** Visual regression testing works on a machine in use, with no
risk of touching the desktop. Native window chrome is not in the pictures.

## D10 — Craft Anything is not part of this workflow

**Context.** The first architecture review suggested using `storytold/craft-anything`
(Deep mode) to map FreeShow's modules, IPC and behaviour before porting. It is
installed (`craft-anything-cli 0.5.0`) and was considered again here.

**Decision.** Do not use it. It is not referenced by this repository and is not a
dependency of any step.

**Why.** Its value is inspecting software you cannot read: binaries, obfuscated
JavaScript, Electron bundles without source. FreeShow is GPL and fully readable,
and every question so far was answered faster by reading it directly:

| Question | How it was actually answered |
| --- | --- |
| Which client drives navigation? | `src/server/controller/App.svelte` |
| How is a show stored and ordered? | `types/Show.ts`, `layouts[activeLayout].slides` |
| Why did the renderer not match? | `Zoomed.svelte` lays out at 1920×1080 and scales |
| What transitions exist? | `TransitionType` union in `types/Show.ts` |
| How do groups work? | `group: "."` starts, `null` continues |

The parity work that remains is behavioural — screenshots, text metrics, protocol
captures — and Craft Anything does not produce those. Playwright, `sharp` and a
pinned reference checkout do, reproducibly, in CI.

Its "rebuild" mode would also be counterproductive: an agent regenerating an app
is the opposite of porting behaviour deliberately.

**Consequences.** One less toolchain, one less alpha dependency, and evidence
that any CI run can reproduce. Keep it installed for genuinely closed targets if
they ever appear (a vendor SDK binary, an undocumented format); that is a
different problem from this one.

## D11 — Session state is a JSON file, not SQLite

**Context.** DEV-005 originally said "no SQLite persistence", as if SQLite were
the goal. What a service notices is remembering the last project, not the
storage engine.

**Decision.** The application's own state — recently opened projects — lives in
one pretty-printed JSON file under the platform data directory
(`session.json`, overridable with `CJCRSG_DATA_DIR`). Projects themselves are
`.cjcp` JSON.

**Why.** The file is a list of paths plus names: reading it is one small parse,
writing it is an atomic rename, and a corrupt file degrades to an empty list.
SQLite would add a dependency, a schema and a migration story for data that
costs nothing to lose. If the store later grows into library metadata worth
querying, that is the moment to reconsider — not before.

**Consequences.** No migrations, no locks, trivially inspectable. FreeShow's own
database import is separate work (DEV-005): we would read *its* store, not write
our own with SQLite.

## D12 — Ship our own remote and stage clients; do not speak FreeShow's Socket.IO protocol

**Context.** DEV-003: FreeShow's shipped remote and stage web clients speak
Socket.IO to the app. Ours speaks JSON/HTTP on 5520 and ships its own page.
Making the FreeShow clients work looked like a transport problem.

**Decision.** Do not implement the Socket.IO surface. Ship our own clients: the
HTTP remote page, and native output windows for stage/confidence.

**Why.** It is not a transport problem. Read the stage client in the reference
(`src/server/stage/util/receiver.ts`): every channel carries FreeShow's own data
model. `LAYOUT` expects a `StageLayout` — templates, items, resolution, style
overrides — and `SHOW_DATA` expects a FreeShow `Show` with layouts, slides and
items. Our engine deliberately does not model styles or templates
(`docs/architecture.md`); our renderer is a consumer of `RenderState`, not of
FreeShow's layout tree.

A Socket.IO server that accepts the connection and cannot fill those payloads
would look compatible and show an empty stage — worse than a documented
limitation. Real compatibility means a FreeShow projection layer over our
domain, which starts by modelling styles and templates, not by adding a crate.

**Consequences.** FreeShow's remote and stage pages cannot connect to us; that is
recorded as a decision rather than left as an open deviation. Our own clients are
the supported surface. If a church specifically needs the FreeShow client, the
work is a projection layer, and it should be planned as one.

## D13 — Parity is checked by contracts, differential state and independent verification

**Context.** The parity plan (`docs/parity-workflow.md`) compared screenshots and
final states, and let the agent that read FreeShow also write the implementation
and the scenarios. An agent can then implement a wrong interpretation, write tests
that fit it, and report success. An external review of the plan (ChatGPT, project
`cjcrsg-presenter`, 2026-11-09) reached the same conclusion.

**Decision.**
1. **Behavioural contracts are the specification.** `docs/contracts/` holds one
   contract per behaviour: preconditions, action, expected state, events, side
   effects, edge cases, and the reference evidence. Features, scenarios, tests and
   deviations refer to contract IDs; they do not restate them.
2. **Every reference observation is labelled** `observed`, `inferred` or `unknown`.
   Only `observed` behaviour may become a required parity behaviour without
   approval. `inferred` needs more evidence or an explicit provisional contract.
3. **Differential runs compare normalised state after every action**, not only the
   final state. Scenarios use semantic actions (`next_slide`), never UI selectors.
4. **Visual parity has three separate checks:** pixels, geometry and text
   structure, and visible-text content. Thresholds come from repeated captures on
   the same environment, and Linux and Windows keep separate baselines.
5. **Verification is independent.** The verifier runs in its own session, in a
   clean worktree at the exact candidate commit. It may not edit implementation,
   contracts, scenarios or baselines. It must run at least one scenario the
   implementer did not supply. Only the orchestrator records acceptance.
6. **Evidence is a manifest,** naming each artefact, what it proves, and the commit
   it came from. A file-count check is not evidence.

**Why.** The core is already engine-owned and testable without a window (D3, D4),
so the cheapest reliable parity check is a state comparison, not a visual one.
Independence matters because the failure to guard against is an agent confirming
its own interpretation.

**Consequences.** The first milestone is one vertical slice, Next/Previous Slide,
run against FreeShow and our build, verified by a separate session. The
orchestration tooling waits until that slice works. Contract and manifest formats
are not final; changing their shape needs a note here.

**Revisit when.** The slice fails to catch a deliberately wrong implementation, or
independent verification proves too slow to run per milestone.

## D14 — Thinking on V4 Pro, building on V4.1 Flash

**Context.** Both `opencode-go/deepseek-v4-pro` and `opencode-go/deepseek-v4.1-flash#high`
are available. The expensive model is better at reading unfamiliar code, holding a
contract in mind and catching a wrong verdict; the cheap one writes code and runs
tools at a fraction of the cost. A single model choice for every stage pays Pro
prices for mechanical edits, or Flash prices for the judgement calls.

**Constraint that shaped this.** One assistant response is one model. A turn cannot
reason in Pro and then edit in Flash, so the split has to happen at an agent or
session boundary, not inside a turn. OpenCode also stores the model on the
*session*, and selecting a primary agent does not change it, so the orchestrator's
model comes from the root `model` setting while the worker split comes from each
agent's `model` field.

**Decision.**
1. The orchestrator (main session) runs `opencode-go/deepseek-v4-pro`. Global
   default model in `~/.config/opencode/opencode.json`.
2. Code and harness edits are delegated to `opencode-go/deepseek-v4.1-flash#high`
   agents: `implementer` and `harness-engineer` are pinned to Flash.
3. Judgement stages stay on Pro: `reader`, `scenario-author` and `verifier`.
4. Maintenance subagents (`explore`, `general`, `title`, `summary`, `compaction`)
   run on Flash; anything heavier is passed an explicit `model` on the call.
5. A subagent shares the orchestrator's working directory, so stages 5 and 6 keep
   D13's separate-worktree sessions. Their models are pinned, but they are not
   launched as subagents from the main checkout.

**Why.** The failure mode D13 guards against is an agent confirming its own
interpretation, so the model that judges is not the model that built. Spending Pro
on the reader also protects the reference pages, which every later stage cites.

**Consequences.** Orchestration turns cost more and are slower; implementer turns
are cheaper. A Flash implementer can miss an invariant that a Pro reviewer then
has to catch, which is exactly the rework D13's three-round cap bounds. The
conflict of interest this creates is deliberate: verifier on Pro, implementer on
Flash.

**Revisit when.** A Flash implementer produces defects the Pro verifier catches in
most milestones, or Pro's latency on orchestration makes the loop slower than a
single-model one.
