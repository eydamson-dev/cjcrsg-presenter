//! Render slides to standalone HTML using the real components.
//!
//! The point is evidence: the same `SlideView`/`StageView` the app runs are
//! rendered to a file, so a headless browser can screenshot them at exact
//! viewports. No window is created and no desktop is touched, which is what
//! makes visual regression testing possible on a machine in use.

use dioxus::prelude::*;
use presenter_core::{Session, SharedEngine, Transition};

use crate::assets::MAIN_CSS;
use crate::media_panel::MediaPanel;
use crate::outline::{FocusView, OutlinePanel};
use crate::projects::ProjectsPanel;
use crate::slide::{SlideView, StageView};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Layout {
    Audience,
    Stage,
    /// The operator's look-ahead.
    Preview,
    /// The speaker's view: live slide plus a clock.
    Confidence,
    /// The project outline, sections included. The controller now renders it in
    /// the drawer's Shows tab; this layout keeps a standalone evidence render.
    Outline,
    /// The full-screen focus view.
    Focus,
    /// The project's media list.
    Media,
    /// The controller's left project browser. The project file is not read for
    /// this layout; it comes from the session store.
    Recent,
}

/// Render the project browser exactly as the controller does, from the session
/// store. The open project is not known here (the CLI has not read one), so the
/// panel shows the recent rows alone.
pub fn render_recent(session: &Session) -> String {
    let rows = crate::projects::build(None, &session.recent);
    let body = rsx! {
        div { class: "controller",
            div {
                class: "workspace-grid",
                style: "--left-w: 280px; --right-w: 0px;",
                aside { class: "column left",
                    ProjectsPanel {
                        rows,
                        on_open: None,
                        on_forget: None,
                        project_path: None,
                        on_bundle: None,
                        bundle_status: String::new(),
                        error: None,
                    }
                }
            }
        }
    };
    wrap(&dioxus_ssr::render_element(body), None)
}

pub fn render(
    engine: &SharedEngine,
    layout: Layout,
    transition: Transition,
    pause_at_ms: Option<u32>,
    project_path: Option<&std::path::Path>,
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
                message: state.message.clone(),
                timer: state.timer,
                layout: state.stage_layout,
            }
        },
        Layout::Preview => rsx! {
            if let Some(next) = state.next.clone() {
                SlideView {
                    slide: next,
                    output: "Preview".to_string(),
                    animate: false,
                    revision: 0,
                    transition: Transition::none(),
                    play_media: false,
                }
            } else {
                div { class: "slide", p { class: "blank", "End of show" } }
            }
        },
        Layout::Confidence => rsx! {
            div { class: "confidence",
                SlideView {
                    slide: state.slide.clone(),
                    output: String::new(),
                    animate,
                    revision: 0,
                    transition,
                    play_media: true,
                }
                span { class: "confidence-clock", id: "confidence-clock", "--:--" }
            }
        },
        Layout::Outline => rsx! {
            div { class: "controller",
                OutlinePanel {
                    items: crate::outline::build(&engine.project()),
                    current: engine.current_show(),
                    on_play: None,
                }
            }
        },
        Layout::Focus => {
            let (slide_id, position, total) = engine.cursor();
            rsx! {
                div { class: "controller",
                    FocusView {
                        items: crate::outline::build(&engine.project()),
                        current: engine.current_show(),
                        on_play: None,
                        on_exit: None,
                        slide: slide_id,
                        position,
                        total,
                    }
                }
            }
        }
        Layout::Media => {
            let project = engine.project();
            let root = project_path.and_then(|path| path.parent());
            rsx! {
                div { class: "controller",
                    MediaPanel { items: crate::media_panel::build(&project, root) }
                }
            }
        }
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
  // A confidence clock, if this page has one.
  const clock = document.getElementById("confidence-clock");
  if (clock) {{
    const paint = () => {{
      clock.textContent = new Date().toLocaleTimeString([], {{ hour: "2-digit", minute: "2-digit" }});
    }};
    paint();
    setInterval(paint, 1000);
  }}
</script>
</body></html>
"#
    )
}
