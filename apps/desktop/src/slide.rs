//! The slide renderer.
//!
//! Deliberately minimal: Experiment 1 proves state delivery, not typography.
//! Real renderer parity is Experiment 2.

use dioxus::prelude::*;
use presenter_core::RenderSlide;

#[component]
pub fn SlideView(slide: RenderSlide, output: String, animate: bool, revision: u64) -> Element {
    // Alternating two identical animations retriggers the fade when the revision
    // changes, without remounting the subtree: changing `animation-name` restarts
    // the animation, while a single class name would not replay on the next slide.
    let class = match (animate, revision % 2) {
        (false, _) => "slide",
        (true, 0) => "slide fade-a",
        (true, _) => "slide fade-b",
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
                        "{element.text}"
                    }
                }
            }
        }
    }
}
