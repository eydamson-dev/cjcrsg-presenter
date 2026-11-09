//! Render slides to standalone HTML using the real components.
//!
//! The point is evidence: the same `SlideView`/`StageView` the app runs are
//! rendered to a file, so a headless browser can screenshot them at exact
//! viewports. No window is created and no desktop is touched, which is what
//! makes visual regression testing possible on a machine in use.

use dioxus::prelude::*;
use presenter_core::{Session, SharedEngine, Transition};

use crate::assets::MAIN_CSS;
use crate::recent::RecentProjects;
use crate::slide::{SlideView, StageView};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Layout {
    Audience,
    Stage,
    /// The controller's recent-projects panel. The project file is not read for
    /// this layout; it comes from the session store.
    Recent,
}

/// Render the recent-projects panel exactly as the controller does.
pub fn render_recent(session: &Session) -> String {
    let body = rsx! {
        div { class: "controller",
            RecentProjects { items: session.recent.clone(), on_open: None }
        }
    };
    wrap(&dioxus_ssr::render_element(body), None)
}

pub fn render(
    engine: &SharedEngine,
    layout: Layout,
    transition: Transition,
    pause_at_ms: Option<u32>,
) -> String {
    let state = engine.state();
    // A frozen frame makes a transition reviewable in a still image.
    let animate = pause_at_ms.is_some();

    let body = match layout {
        Layout::Audience => rsx! {
            SlideView {
                slide: state.slide.clone(),
                output: "Audience".to_string(),
                animate,
                revision: 0,
                transition,
                play_media: true,
            }
        },
        Layout::Stage => rsx! {
            StageView {
                current: state.slide.clone(),
                next: state.next.clone(),
                output: "Stage".to_string(),
                notes: state.notes.clone(),
            }
        },
        // `main` renders this layout from the session store, because it has
        // nothing to do with the loaded project.
        Layout::Recent => unreachable!("recent is rendered by render_recent"),
    };

    wrap(&dioxus_ssr::render_element(body), pause_at_ms)
}

fn wrap(body: &str, pause_at_ms: Option<u32>) -> String {
    let pause = match pause_at_ms {
        Some(ms) => format!(
            // Freeze the animated layer, not the scaled surface: since the
            // transition moved to `.slide-body`, that is where the animation
            // lives.
            "<style>.slide-body {{ animation-delay: -{ms}ms; animation-play-state: paused; }}</style>"
        ),
        None => String::new(),
    };

    format!(
        r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CJCRSG render</title>
<style>{MAIN_CSS}</style>
{pause}
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
