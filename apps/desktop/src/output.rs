//! One output window: an independent `VirtualDom` fed by the shared hub.

use dioxus::prelude::*;
use presenter_core::Revision;

use crate::runtime::{OutputKind, Shared};
use crate::slide::{SlideView, StageView};

#[derive(Props, Clone, PartialEq)]
pub struct OutputProps {
    pub kind: OutputKind,
    pub shared: Shared,
}

#[component]
pub fn OutputRoot(props: OutputProps) -> Element {
    let kind = props.kind;
    let shared = props.shared.0.clone();

    // Captured once per window instance. The first revision this window ever
    // renders is not animated: reopening an output must not replay a transition
    // the congregation already saw.
    let first_revision: Revision = use_hook(|| shared.engine.revision());

    // Snapshot, not the cached state: a window opening mid-clip must start at
    // the current position, not at the moment the slide was published.
    let initial = shared.engine.snapshot();
    let current = use_signal(|| initial);

    let hub = shared.engine.clone();
    use_future(move || {
        let hub = hub.clone();
        let mut current = current;
        async move {
            let mut receiver = hub.subscribe();
            loop {
                // Read through the receiver, never a separate snapshot: there is
                // then no window between "I read state" and "I am listening" in
                // which a publish could be lost.
                let snapshot = receiver.borrow_and_update().clone();
                current.set(snapshot);

                if receiver.changed().await.is_err() {
                    break;
                }
            }
        }
    });

    let reporter = shared.clone();
    use_effect(move || {
        let revision = current.read().revision;
        reporter.report_applied(kind, revision);
    });

    // Outputs lay out at 1920x1080 and scale to the window.
    use_future(|| async move {
        let script = r#"
            (() => {
                const fit = () => document.documentElement.style.setProperty(
                    "--slide-scale", String(window.innerWidth / 1920));
                fit();
                addEventListener("resize", fit);
            })();
        "#;
        let _ = document::eval(script).await;
    });

    // A stage clock ticks in the page, not through Rust: a per-second state
    // publish would wake every output for a label.
    if kind == OutputKind::Stage {
        use_future(|| async move {
            let script = r#"
                (() => {
                    const tick = () => {
                        const el = document.getElementById('stage-clock');
                        if (el) el.textContent = new Date().toLocaleTimeString([], {
                            hour: '2-digit', minute: '2-digit'
                        });
                    };
                    tick();
                    setInterval(tick, 1000);
                })();
            "#;
            let _ = document::eval(script).await;
        });
    }

    let state = current.read().clone();
    let animate = state.revision != first_revision;
    let transition = state
        .transition
        .as_ref()
        .map(|transition| transition.spec())
        .unwrap_or_else(presenter_core::Transition::none);

    rsx! {
        document::Style { {crate::assets::MAIN_CSS} }
        document::Title { "CJCRSG — {kind.label()}" }

        if kind == OutputKind::Stage {
            StageView {
                current: state.slide.clone(),
                next: state.next.clone(),
                output: kind.label().to_string(),
                notes: state.notes.clone(),
            }
        } else {
            SlideView {
                slide: state.slide.clone(),
                output: kind.label().to_string(),
                animate,
                revision: state.revision,
                transition,
                play_media: true,
            }
        }
    }
}
