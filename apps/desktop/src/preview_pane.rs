//! A live preview of the published slide, for the controller.
//!
//! It renders the same `SlideView` the outputs use, scaled to fit its pane. It
//! is a consumer of `RenderState`: it never decides which slide is live and
//! never plays audio.

use dioxus::prelude::*;
use presenter_core::{RenderSlide, Transition};

use crate::slide::SlideView;

#[component]
pub fn PreviewPane(slide: RenderSlide, slide_id: String, position: usize, total: usize) -> Element {
    use_future(|| async move {
        let script = r#"
            (() => {
                const frame = document.querySelector('.preview-frame');
                if (!frame) return;
                const fit = () => {
                    const scale = frame.clientWidth / 1920;
                    frame.style.height = Math.round(1080 * scale) + 'px';
                    frame.style.setProperty('--slide-scale', String(scale));
                };
                fit();
                if (window.__cjcpPreview) window.__cjcpPreview.disconnect();
                window.__cjcpPreview = new ResizeObserver(fit);
                window.__cjcpPreview.observe(frame);
            })();
        "#;
        let _ = document::eval(script).await;
    });

    rsx! {
        section { class: "panel preview-panel",
            div { class: "preview-head",
                span { class: "name", "{slide_id}" }
                span { class: "preview-meta", "{position} / {total}" }
            }
            div { class: "preview-frame",
                div { class: "preview-slide",
                    SlideView {
                        slide: slide,
                        output: String::new(),
                        animate: false,
                        revision: 0,
                        transition: Transition::none(),
                        play_media: false,
                    }
                }
            }
        }
    }
}
