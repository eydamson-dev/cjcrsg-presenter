//! One output window: an independent `VirtualDom` fed by the shared hub.

use dioxus::prelude::*;
use presenter_core::Revision;

use crate::runtime::{OutputKind, Shared};
use crate::slide::SlideView;

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

    let initial = shared.engine.state();
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

    let state = current.read().clone();
    let animate = state.revision != first_revision;

    rsx! {
        document::Style { {crate::assets::MAIN_CSS} }
        document::Title { "CJCRSG — {kind.label()}" }

        SlideView {
            slide: state.slide.clone(),
            output: kind.label().to_string(),
            animate,
            revision: state.revision,
        }
    }
}
