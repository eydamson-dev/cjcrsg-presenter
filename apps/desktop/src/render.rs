//! Render slides to standalone HTML using the real components.
//!
//! The point is evidence: the same `SlideView`/`StageView` the app runs are
//! rendered to a file, so a headless browser can screenshot them at exact
//! viewports. No window is created and no desktop is touched, which is what
//! makes visual regression testing possible on a machine in use.

use dioxus::prelude::*;
use presenter_core::SharedEngine;

use crate::assets::MAIN_CSS;
use crate::slide::{SlideView, StageView};

pub enum Layout {
    Audience,
    Stage,
}

pub fn render(engine: &SharedEngine, layout: Layout) -> String {
    let state = engine.state();

    let body = match layout {
        Layout::Audience => rsx! {
            SlideView {
                slide: state.slide.clone(),
                output: "Audience".to_string(),
                animate: false,
                revision: state.revision,
            }
        },
        Layout::Stage => rsx! {
            StageView {
                current: state.slide.clone(),
                next: state.next.clone(),
                output: "Stage".to_string(),
            }
        },
    };

    wrap(&dioxus_ssr::render_element(body))
}

fn wrap(body: &str) -> String {
    format!(
        r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CJCRSG render</title>
<style>{MAIN_CSS}</style>
<style>html,body,#main{{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}}</style>
</head><body><div id="main">{body}</div>
<script>
  // Lay out at 1920x1080 and scale to the window, the way an output does.
  const fit = () => document.documentElement.style.setProperty(
    "--slide-scale", String(window.innerWidth / 1920));
  fit();
  addEventListener("resize", fit);
</script>
</body></html>
"#
    )
}
