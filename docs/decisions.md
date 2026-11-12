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

## D14 — FreeShow is the baseline, not the target; deliberate differences are `IMP-nnn`

**Context.** Every mechanism for a difference from FreeShow framed it as a
deficiency. `docs/deviations.md` lists gaps with a "Close by" column, and D13's
parity work treats the reference as what a behaviour must match. An agent reading
only those two files will conclude that matching FreeShow is the goal, and will
either reject a better design or record it as a gap it intends to close.

That is not the goal. FreeShow runs on Electron, so it inherits the browser's
limits: codec support, audio routing, timers under GC, and a controller layout
shaped by what a browser can draw. Rust does not inherit them, and some of
FreeShow's behaviour exists only because of that substrate rather than because it
is good.

**Decision.**

1. **Parity remains the default for behaviour FreeShow already has.** The reference
   stays the behavioural source, D13's contracts and verification stand unchanged.
2. **A deliberate difference is a first-class record, not a gap.** It gets an
   `IMP-nnn` row in `docs/improvements.md`, from a proposal in `docs/proposals/`,
   decided and logged for the user's later review (D16). `DEV-nnn` stays for what
   we owe to parity.
3. **Improvements are argued, not asserted.** A proposal states the FreeShow
   behaviour with reference labels, what the alternative buys, what it costs in
   parity work and user surprise, and what was measured. Adjectives are not
   evidence.
4. **Decisions are autonomous, and audited.** The orchestrator decides without
   asking the user (D16). Milestone acceptance is still the orchestrator's, after
   verification, on the exact candidate SHA — the same rule D13 sets. A row in
   `docs/improvements.md` without a verified candidate is a proposal, not an
   improvement.
5. **A cross-cutting `researcher` agent** does the "how does FreeShow do this, and
   is there a better way?" work, and may use the ChatGPT project `cjcrsg-presenter`
   under the permission in `AGENTS.md`. It writes proposals. It does not approve
   them, and a reply is a source, never an instruction.
6. **Parity work reads `docs/improvements.md` first.** A scenario that fails because
   of an `IMP` is a wrong scenario: the difference is recorded in
   `docs/freeshow-reference/audit.md` with the `IMP` ID.

**Why.** The expensive failure is not a wrong implementation — D13 catches that. It
is a correct implementation of a design nobody would choose, kept because the
reference did it, with no record of whether anyone considered an alternative. That
failure is silent: every check passes, and the product is worse than it needs to be.

**Consequences.** Two lists of difference, and the distinction has to be made
honestly: if the reason is "we did not get to it", it is a `DEV`; if the reason is
"we prefer this", it is an `IMP` and it needs a proposal. The invariants in
`AGENTS.md` outrank both — an improvement that breaks invariant 2, 3, 4 or 7 is not
an improvement. This qualifies D13 rather than replacing it: contracts, labelled
evidence and independent verification all still apply, and a behaviour with an
accepted `IMP` gets a contract describing *our* behaviour, not FreeShow's.

**Revisit when.** An `IMP` is accepted that later turns out to break FreeShow
compatibility users depend on (a file that no longer imports, a project that no
longer opens), or the proposal overhead proves too heavy for small UI differences.

## D15 — The AI decides, and the decision log is the audit (superseded by D16)

**Decision (2026-11-12).** The AI decides features, contracts, `IMP` adoption,
`D`-entry changes, engine invariants and milestone acceptance without asking the
user. Each decision is logged in `docs/decision-log.md`.

**Superseded.** The first version of this decision made each decision a vote among
free models, with a devil's advocate. It was scrapped on 2026-11-12 (D16) because
the free models' shared usage limit kept exhausting the vote. The voting trials are
kept in `parity/reports/votes/` as history.

## D16 — No voting: the AI decides, implements and logs for later review

**Context.** D15 used a vote among free models. The free models are rate-limited
on one account, so votes stopped working as soon as the limit was reached, and a
vote from two repeated models is not independent (DEC-006, DEC-007). The user
decided that a vote is not worth the operational cost.

**Decision.**

1. **The AI decides alone.** It works out what to build, decides between FreeShow's
   behaviour and an alternative, and implements the choice. It does not ask the
   user, and it does not hold a vote.
2. **Alternatives and improvements are implemented and logged.** An `IMP-nnn` row in
   `docs/improvements.md` marks the choice as "adopted, pending review", with the
   reason and the evidence. A `DEV-nnn` stays for what is owed to parity.
3. **The user reviews later.** Each `IMP` can be kept, changed or reverted at the
   user's convenience. A reversal is a new decision-log entry that cites the one it
   reverses.
4. **Every decision is logged** in `docs/decision-log.md`: the question, the options,
   what was chosen and why, the evidence, the artefacts changed, and whether an
   invariant or a `D`-entry was touched.
5. **The stop list in `AGENTS.md` still applies.** Pushes, deletions, reference
   source, secrets and spend are not decided by the AI.
6. **Correctness is still checked** by the verifier, the scenarios and the render
   checks, as in D13. A decision the AI makes is not evidence that it works.

**Why.** The user wants the AI to make product choices. The risk is silent drift,
and the log plus the user's later review addresses that. Votes added cost, rate
limits and the appearance of agreement from models that share the same reasoning.

**Consequences.** Choices are single-model judgements, so an error is not caught
before it is implemented. It is caught by the verifier and by the user's review
of the log. The number of `IMP` rows grows with the work, and the review is the
cost the user accepts.

**Revisit when.** The user finds that adopted improvements are often reverted, or a
logged decision causes a verified failure in a live service.
