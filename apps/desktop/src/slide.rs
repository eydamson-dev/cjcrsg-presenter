//! The slide renderer.
//!
//! Deliberately minimal: Experiment 1 proves state delivery, not typography.
//! Real renderer parity is Experiment 2.

use dioxus::prelude::*;
use presenter_core::{RenderSlide, TransitionKind};

#[component]
pub fn SlideView(
    slide: RenderSlide,
    output: String,
    animate: bool,
    revision: u64,
    transition: TransitionKind,
) -> Element {
    // Alternating two identical animations retriggers the effect when the
    // revision changes, without remounting the subtree: changing
    // `animation-name` restarts the animation, while a single class name would
    // not replay on the next slide.
    let class = match (animate, transition.animation(), revision % 2) {
        (true, Some(name), 0) => format!("slide tx-{name}-a"),
        (true, Some(name), _) => format!("slide tx-{name}-b"),
        _ => "slide".to_string(),
    };

    rsx! {
        div {
            class: "{class}",

            div { class: "output-badge", "{output}" }

            if slide.is_blank() {
                p { class: "blank", "No project loaded" }
            } else {
                for element in slide.elements.iter() {
                    div {
                        key: "{element.id}",
                        class: "{element.class_name}",
                        style: "{element.style}",
                        // FreeShow stores each line as its own element; matching
                        // that keeps line boxes measurable and comparable.
                        for (index, line) in element.text.split('\n').enumerate() {
                            div {
                                key: "{element.id}-line-{index}",
                                class: "line",
                                "{line}"
                            }
                        }
                    }
                }
            }
        }
    }
}

/// A stage display: the live slide beside the one that comes next.
///
/// The next slide comes from the published state, not from the stage looking
/// ahead — a stage that computes its own "next" can disagree with the engine.
#[component]
pub fn StageView(current: RenderSlide, next: Option<RenderSlide>, output: String) -> Element {
    rsx! {
        div { class: "stage",
            div { class: "pane",
                div { class: "pane-label", "Live" }
                div { class: "pane-body",
                    SlideView { slide: current, output: output, animate: false, revision: 0, transition: TransitionKind::None }
                }
            }
            div { class: "pane",
                div { class: "pane-label", "Next" }
                div { class: "pane-body",
                    if let Some(upcoming) = next {
                        SlideView { slide: upcoming, output: String::new(), animate: false, revision: 0, transition: TransitionKind::None }
                    } else {
                        p { class: "blank", "End of show" }
                    }
                }
            }
        }
    }
}
