//! The controller window.
//!
//! Owns the command surface and the output registry. It is the only place that
//! creates windows — outputs never spawn other outputs.

use std::rc::Rc;
use std::time::Duration;

use dioxus::prelude::*;
use dioxus_desktop::{use_window, Config, DesktopContext, WindowBuilder, WindowCloseBehaviour};
use presenter_core::Revision;

use crate::output::{OutputProps, OutputRoot};
use crate::runtime::{AppState, OutputKind, Shared};

#[component]
pub fn App() -> Element {
    let shared = use_signal(|| Shared(Rc::new(AppState::new())));
    let tick = use_signal(|| 0u64);

    // Drives the per-output revision readout. 250 ms is fast enough to watch
    // recovery happen and slow enough to stay invisible.
    use_future(move || {
        let mut tick = tick;
        async move {
            loop {
                tokio::time::sleep(Duration::from_millis(250)).await;
                tick += 1;
            }
        }
    });

    let window = use_window();
    let app: Rc<AppState> = shared.read().0.clone();

    let (slide_id, position, total) = app.cursor();
    let revision = app.revision();

    let rows: Vec<(OutputKind, bool, Option<Revision>)> = OutputKind::ALL
        .iter()
        .map(|kind| (*kind, app.is_open(*kind), app.applied(*kind)))
        .collect();

    let open_count = rows.iter().filter(|(_, open, _)| *open).count();
    let behind = rows
        .iter()
        .filter(|(_, open, applied)| *open && *applied != Some(revision))
        .count();

    rsx! {
        document::Stylesheet { href: asset!("/assets/main.css") }
        document::Title { "CJCRSG Presenter — Experiment 1" }

        div { class: "controller",

            header {
                h1 { "CJCRSG Presenter" }
                p { class: "subtitle", "Experiment 1 · multi-window state recovery" }
            }

            section { class: "panel",
                div { class: "readout",
                    span { class: "label", "Slide" }
                    span { class: "value", "{slide_id}" }
                }
                div { class: "readout",
                    span { class: "label", "Position" }
                    span { class: "value", "{position} / {total}" }
                }
                div { class: "readout",
                    span { class: "label", "Revision" }
                    span { class: "value", "{revision}" }
                }

                div { class: "controls",
                    button {
                        class: "btn",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.previous_slide(); }
                        },
                        "Previous"
                    }
                    button {
                        class: "btn primary",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.next_slide(); }
                        },
                        "Next"
                    }
                    button {
                        class: "btn",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.first_slide(); }
                        },
                        "First"
                    }
                }
            }

            section { class: "panel",
                h2 { "Outputs" }
                p { class: "hint",
                    "{open_count} open · "
                    if behind == 0 { "all in sync" } else { "{behind} behind revision {revision}" }
                }

                for (kind, open, applied) in rows {
                    div { class: "output-row",
                        span { class: "name", "{kind.label()}" }
                        span {
                            class: if open { "status open" } else { "status closed" },
                            if open { "open" } else { "closed" }
                        }
                        span { class: "applied",
                            match applied {
                                Some(value) if value == revision => format!("rev {value} ✓"),
                                Some(value) => format!("rev {value} · behind {revision}"),
                                None => "—".to_string(),
                            }
                        }
                        button {
                            class: "btn small",
                            onclick: {
                                let app = app.clone();
                                let window = window.clone();
                                move |_| {
                                    if app.is_open(kind) {
                                        app.close_output(kind);
                                    } else {
                                        open_output(window.clone(), app.clone(), kind);
                                    }
                                }
                            },
                            if open { "Close" } else { "Open" }
                        }
                    }
                }
            }

            footer {
                p { "Close any output, advance the show, then reopen it. "
                    "It must return to the live slide, not the slide it left." }
            }
        }
    }
}

/// Spawn an output window backed by its own `VirtualDom`.
pub(crate) fn open_output(window: DesktopContext, app: Rc<AppState>, kind: OutputKind) {
    let props = OutputProps {
        kind,
        shared: Shared(app.clone()),
    };
    let dom = VirtualDom::new_with_props(OutputRoot, props);

    let config = Config::new()
        .with_window(WindowBuilder::new().with_title(format!("CJCRSG — {}", kind.label())))
        .with_background_color((0, 0, 0, 255))
        .with_close_behaviour(WindowCloseBehaviour::WindowCloses);

    let pending = window.new_window(dom, config);

    spawn(async move {
        match pending.try_resolve().await {
            Ok(context) => {
                // Registered weakly: the registry must never keep a window alive.
                app.register(kind, Rc::downgrade(&context));
                tracing::info!(output = kind.label(), "output window opened");
            }
            Err(err) => {
                tracing::error!(output = kind.label(), ?err, "output window failed to open");
            }
        }
    });
}
