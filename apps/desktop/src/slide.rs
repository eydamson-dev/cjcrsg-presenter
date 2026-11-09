//! The slide renderer.
//!
//! Deliberately minimal: Experiment 1 proves state delivery, not typography.
//! Real renderer parity is Experiment 2.

use dioxus::prelude::*;
use presenter_core::{easing_css, MediaKind, RenderMedia, RenderSlide, Transition};

#[component]
pub fn SlideView(
    slide: RenderSlide,
    output: String,
    animate: bool,
    revision: u64,
    transition: Transition,
    /// False on a stage: a second copy of the slide must not play its audio.
    play_media: bool,
) -> Element {
    // Alternating two identical animations retriggers the effect when the
    // revision changes, without remounting the subtree: changing
    // `animation-name` restarts the animation, while a single class name would
    // not replay on the next slide.
    let class = match (animate, transition.kind.animation(), revision % 2) {
        (true, Some(name), 0) => format!("tx-{name}-a"),
        (true, Some(name), _) => format!("tx-{name}-b"),
        _ => String::new(),
    };

    // Duration and curve come from the project, not the stylesheet. The class
    // sets a default, these longhands override it; inline wins over the class.
    let timing = if animate && transition.kind.animation().is_some() {
        format!(
            "animation-duration: {}ms; animation-timing-function: {};",
            transition.duration_ms,
            easing_css(&transition.easing)
        )
    } else {
        String::new()
    };

    rsx! {
        div { class: "slide",
            div { class: "slide-body {class}", style: "{timing}",
                div { class: "output-badge", "{output}" }

                if slide.is_blank() {
                    p { class: "blank", "No project loaded" }
                } else {
                    for element in slide.elements.iter() {
                        if let Some(media) = element.media.as_ref() {
                            MediaView {
                                key: "{element.id}",
                                class_name: element.class_name.clone(),
                                style: element.style.clone(),
                                media: media.clone(),
                                play: play_media,
                            }
                        } else {
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
    }
}

/// A stage display: the live slide beside the one that comes next.
///
/// The next slide comes from the published state, not from the stage looking
/// ahead — a stage that computes its own "next" can disagree with the engine.
#[component]
pub fn StageView(
    current: RenderSlide,
    next: Option<RenderSlide>,
    output: String,
    notes: String,
) -> Element {
    rsx! {
        div { class: "stage",
            div { class: "pane",
                div { class: "pane-label",
                    span { "Live" }
                    span { class: "clock", id: "stage-clock", "--:--" }
                }
                div { class: "pane-body",
                    SlideView {
                        slide: current,
                        output: output,
                        animate: false,
                        revision: 0,
                        transition: Transition::none(),
                        play_media: false,
                    }
                }
                if !notes.is_empty() {
                    div { class: "pane-notes", "{notes}" }
                }
            }
            div { class: "pane",
                div { class: "pane-label", "Next" }
                div { class: "pane-body",
                    if let Some(upcoming) = next {
                        SlideView {
                            slide: upcoming,
                            output: String::new(),
                            animate: false,
                            revision: 0,
                            transition: Transition::none(),
                            play_media: false,
                        }
                    } else {
                        p { class: "blank", "End of show" }
                    }
                }
            }
        }
    }
}

/// An image, video or audio item.
///
/// `play` is false on the stage so a second copy of the slide does not play the
/// same audio; the engine still owns whether the output is live.
#[component]
fn MediaView(class_name: String, style: String, media: RenderMedia, play: bool) -> Element {
    let autoplay = play && media.playing;
    match media.kind {
        MediaKind::Image => rsx! {
            img { class: "{class_name}", src: "{media.src}", style: "{style}" }
        },
        MediaKind::Video => rsx! {
            video {
                class: "{class_name}",
                src: "{media.src}",
                style: "{style}",
                autoplay,
                muted: media.muted,
                loop: media.looped,
                playsinline: true,
            }
        },
        MediaKind::Audio => rsx! {
            audio {
                src: "{media.src}",
                autoplay,
                muted: media.muted,
                loop: media.looped,
            }
        },
        MediaKind::Other => rsx! {},
    }
}
