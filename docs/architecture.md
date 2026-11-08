# Architecture

## The one invariant

> The engine owns the show. Windows own pixels.

A closed output window is an inconvenience, not an event. The active slide,
media position and transition state live in the engine and survive any window
lifecycle. Every output is reconstructible from a single snapshot.

## Layers

```
                  ┌──────────────────────────────┐
   remote / stage │  axum (HTTP + WebSocket)      │  external clients only
   phones, tablets│                              │
                  └──────────────┬───────────────┘
                                 │ commands
                                 ▼
                  ┌──────────────────────────────┐
                  │  show-engine                 │  pure state machine
                  │  Project · Show · Group ·    │  no IO, no dioxus
                  │  Slide · commands            │  cargo test only
                  └──────────────┬───────────────┘
                                 │ publish(state)
                                 ▼
                  ┌──────────────────────────────┐
                  │  RenderHub                   │  Arc<RenderHub>
                  │  tokio::sync::watch          │  latest snapshot wins
                  └───┬──────────┬───────────┬───┘
                      │          │           │   subscribe()
                      ▼          ▼           ▼
                 Audience    Stage       Preview      one VirtualDom
                  WebView    WebView      WebView      per output
```

There is deliberately **no socket, channel or event bus between the engine and
local output windows**. `watch` gives each subscriber the latest complete state,
which is exactly the semantic required: an output that missed five revisions
needs revision 43, not a replay of 38–42.

## State model

```rust
pub struct RenderState {
    pub revision: u64,        // monotonic; increments on every meaningful change
    pub show_id: SlideId,     // placeholder types, see crates/core
    pub slide_id: SlideId,
    pub slide: RenderSlide,   // render-ready projection, not the domain model
    pub transition: Option<TransitionState>,
}
```

Two models, deliberately:

- **Domain** (`domain.rs`) — what the project *means*: shows, groups, slides,
  elements, media references, settings. Persisted, compatible with FreeShow.
- **Render model** (`render_model.rs`) — what an output needs *this frame*.
  Contains resolved text, class names, inline style and asset URLs. Never
  persisted.

The projection from domain to render model is one function, in one place. That
is where FreeShow's rendering rules get encoded, and where parity bugs will be
found.

### Revisions

`watch` alone is not enough to prove correct recovery: a window needs to know
*whether* it rendered the current state. Each output tracks the last revision it
applied and reports it. The restart test asserts the reopened window reaches the
engine's current revision within one second.

Revisions are also the boundary for transitions: a transition command carries
the revision it belongs to, so a late renderer does not animate a stale change.

## Output windows

```rust
pub struct OutputManager {
    outputs: HashMap<OutputId, OutputHandle>,
}

pub struct OutputHandle {
    output_id: OutputId,
    window: Weak<DesktopService>, // weak: never keep a window alive
}
```

Rules:

1. Only `OutputManager` creates or destroys windows.
2. `DesktopService::new_window(dom, cfg)` — one `VirtualDom` per output.
3. Every output has an explicit teardown path (create → register → subscribe →
   detect close → unsubscribe → deregister). Without it the `VirtualDom` leaks.
4. Output windows do **not** take keyboard focus on creation. They must not
   intercept shortcuts meant for the controller.
5. Controller and outputs have different close policies. Closing the last output
   must not exit the application.
6. Windows report their own failure; a panic in one output must not take down
   the engine.

### Placement

Monitor placement is a separate concern from window creation, behind a trait:

```rust
pub trait WindowPlacement {
    fn monitors(&self) -> Vec<MonitorInfo>;
    fn place(&self, window: &DesktopContext, target: &OutputTarget) -> Result<()>;
    fn fullscreen(&self, window: &DesktopContext) -> Result<()>;
}
```

`set_fullscreen()` uses the window's *current* monitor. The order is always:
resolve monitor → position → wait for the native window → fullscreen → verify.
Monitor indices are never persisted; they are not stable across boots or
hotplug. Wayland compositors may refuse positioning entirely — the design must
degrade to "fullscreen on whatever monitor the user drags it to", not break.

## Renderer

The renderer is HTML/CSS inside the WebView. Dioxus produces the DOM; the
browser does layout, painting and compositing.

**DOM contract.** The port preserves element types, class names, ordering,
parent-child relationships, data attributes, inline styles and CSS custom
properties. Do not "clean up" the DOM during the port: the original selectors
depend on it.

**Scoped styles.** Svelte's compiled scope classes are not part of the contract.
Extract rules into explicit classes on first touch of each component. Do not
build the new application around `svelte-xxxxxx` names.

**`dangerous_inner_html` is not approved as a bridge.** It creates a second
reconciliation path with different semantics, inside the one subtree that needs
transitions. If the legacy renderer is ever needed, it goes behind an explicit
JavaScript island with a controller interface.

### Text autofit

The highest-fidelity risk in the whole project. Order of preference:

1. **CSS-only** — `container-type: size`, `cqi` units, `clamp()`,
   `text-wrap: balance`. Fits during layout, zero reflow, 60 fps safe.
2. **Measurement bridge** — only where CSS provably cannot express the rule.
   Measure an element already in the DOM but not yet painted, binary-search the
   size, apply via a CSS custom property, and cache by
   `(text, container, typography)`.

Never decrement font size in a loop, and never measure on every render. A
measurement that causes a visible jump at slide entry is a failed implementation
even if the final size is correct — in a live service that is a flicker on every
lyric line.

### Transitions

One command, animated locally:

```rust
pub struct TransitionState {
    pub revision: u64,
    pub id: TransitionId,
    pub kind: TransitionKind,
    pub duration_ms: u32,
    pub started_at: Option<Instant>,
}
```

CSS transitions or the Web Animations API. For cross-output synchronisation,
carry a shared start instant and let each renderer align its clock; do not
assume independently started animations begin on the same frame, and do not
poll Rust for progress.

## Media

`<video>` in the WebView first. It is the cheapest path to parity for ordinary
playback.

Video is also the largest unknown: the same clip in four WebViews may be decoded
four times. That is Experiment 3, and its result decides the media architecture,
not the other way round.

Escape hatches, in order:

1. Native video overlay attached to the output window, HTML/CSS composing around
   it.
2. GStreamer rendering to a native surface composited with the slide renderer.
3. Frame transfer from GStreamer into the WebView — **only if** the first two
   fail, because it means copying and synchronising frames ourselves.

## Devices

Vendor SDKs stay outside the process boundary:

| Subsystem | In-process | Sidecar |
| --- | --- | --- |
| MIDI (`midir`) | ✓ | |
| OSC (`rosc`) | ✓ | |
| LTC (`ltc`) | ✓ | |
| SQLite (`rusqlite`) | ✓ | |
| Audio (GStreamer/CPAL) | ✓ (dedicated thread) | |
| NDI | | ✓ |
| DeckLink / SDI | | ✓ |
| OMT | | ✓ (initially) |

A sidecar flap must never take down a service. Video never crosses to a sidecar
as JSON.

## Threading

- One application-level Tokio runtime. Do not create a runtime per output.
-Never block a real-time audio callback: no allocation, no locks, no database,
  no network.
- `rusqlite` is synchronous; it runs on a dedicated worker, never on the UI
  thread.
- The show engine is `Send + Sync` and holds no handles to windows, webviews or
  media players.

## Failure policy

| Failure | Behaviour |
| --- | --- |
| Output window closes | Engine unaffected; output deregistered; reopen recovers |
| Output window panics | That output only; engine unaffected; reopen recovers |
| Media file missing | Slide still renders; diagnostic logged; no engine change |
| Remote client disconnects | No effect; reconnects and reads current state |
| Database write fails | Surfaced to the controller; never silently dropped |
| Sidecar dies | Feature degraded; core presentation continues |
