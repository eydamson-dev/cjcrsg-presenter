//! The controller window.
//!
//! Owns the command surface and the output registry. It is the only place that
//! creates windows — outputs never spawn other outputs.

use std::rc::Rc;
use std::time::Duration;

use dioxus::prelude::*;
use dioxus_desktop::{use_window, Config, DesktopContext, WindowBuilder, WindowCloseBehaviour};
use presenter_core::{Command, Revision, StageLayout};

use crate::media_panel::MediaPanel;
use crate::outline::{FocusView, OutlinePanel};
use crate::output::{OutputProps, OutputRoot};
use crate::recent::RecentProjects;
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

    // Global keyboard shortcuts, with FreeShow's bindings. The listener lives in
    // the page rather than on a focused element: an operator must not have to
    // click the window first, and focus can sit on any button.
    use_hook({
        let app = app.clone();
        move || {
            spawn(async move {
                let mut keys = document::eval(KEY_SCRIPT);
                while let Ok(key) = keys.recv::<String>().await {
                    if let Some(command) = Command::from_key(&key) {
                        app.apply(command);
                    }
                }
            });
        }
    });

    // Screenshot and manual-test convenience: open outputs on start.
    // `CJCRSG_DEMO_OPEN=audience|stage|preview|confidence|all`
    if let Ok(requested) = std::env::var("CJCRSG_DEMO_OPEN") {
        let kinds: Vec<OutputKind> = match requested.as_str() {
            "all" => OutputKind::ALL.to_vec(),
            "audience" => vec![OutputKind::Audience],
            "stage" => vec![OutputKind::Stage],
            "preview" => vec![OutputKind::Preview],
            "confidence" => vec![OutputKind::Confidence],
            _ => Vec::new(),
        };

        let app = app.clone();
        let window = window.clone();
        use_hook(move || {
            spawn(async move {
                tokio::time::sleep(Duration::from_millis(700)).await;
                for kind in kinds {
                    open_output(window.clone(), app.clone(), kind);
                    tokio::time::sleep(Duration::from_millis(250)).await;
                }
            });
        });
    }

    let (slide_id, position, total) = app.cursor();
    let revision = app.revision();
    let recent = app.recent();
    let mut open_error = use_signal(|| Option::<String>::None);
    let mut message_text = use_signal(String::new);
    let mut timer_minutes = use_signal(|| 5u64);
    let mut focus = use_signal(|| false);
    let mut bundle_status = use_signal(String::new);

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
        document::Style { {crate::assets::MAIN_CSS} }
        document::Title { "CJCRSG Presenter" }

        div { class: "controller",

            header {
                div {
                    h1 { "CJCRSG Presenter" }
                    p { class: "subtitle", "Controller" }
                }
                button {
                    class: "btn",
                    onclick: move |_| focus.toggle(),
                    if focus() { "Exit focus" } else { "Focus" }
                }
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
                    button {
                        class: "btn",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.apply(Command::Clear); }
                        },
                        "Clear"
                    }
                    button {
                        class: "btn",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.apply(Command::Restore); }
                        },
                        "Restore"
                    }
                    button {
                        class: "btn",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.engine.previous_group(); }
                        },
                        "Prev group"
                    }
                    button {
                        class: "btn",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.engine.next_group(); }
                        },
                        "Next group"
                    }
                    button {
                        class: "btn",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.previous_section(); }
                        },
                        "Prev section"
                    }
                    button {
                        class: "btn",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.next_section(); }
                        },
                        "Next section"
                    }
                }
            }

            if focus() {
                FocusView {
                    items: app.outline(),
                    current: app.current_show(),
                    on_play: Some(EventHandler::new({
                        let app = app.clone();
                        move |index: usize| { app.go_to_show(index); }
                    })),
                    on_exit: Some(EventHandler::new(move |_| focus.set(false))),
                    slide: slide_id.clone(),
                    position,
                    total,
                }
            }

            div { class: if focus() { "controller-body hidden" } else { "controller-body" },

            OutlinePanel {
                items: app.outline(),
                current: app.current_show(),
                on_play: Some(EventHandler::new({
                    let app = app.clone();
                    move |index: usize| {
                        app.go_to_show(index);
                    }
                })),
                project_path: app.project_path().map(|path| path.display().to_string()),
                on_bundle: Some(EventHandler::new({
                    let app = app.clone();
                    move |_| match app.bundle_media() {
                        Ok(summary) => bundle_status.set(summary),
                        Err(error) => bundle_status.set(error),
                    }
                })),
                bundle_status: bundle_status(),
            }

            MediaPanel { items: app.media() }

            section { class: "panel",
                h2 { "Stage" }
                p { class: "hint", "The message and countdown appear on the stage display, never on an audience output." }

                div { class: "controls",
                    input {
                        class: "text",
                        placeholder: "Message to stage",
                        value: "{message_text}",
                        oninput: move |event| message_text.set(event.value()),
                    }
                    button {
                        class: "btn small",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.set_message(Some(&message_text())); }
                        },
                        "Send"
                    }
                    button {
                        class: "btn small",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.set_message(None); }
                        },
                        "Clear"
                    }
                }

                div { class: "controls",
                    label { class: "control-label", "Countdown" }
                    input {
                        class: "text number",
                        r#type: "number",
                        min: "1",
                        max: "180",
                        value: "{timer_minutes}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<u64>() {
                                timer_minutes.set(value.clamp(1, 180));
                            }
                        },
                    }
                    span { class: "control-label", "min" }
                    button {
                        class: "btn small",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.set_timer(timer_minutes() * 60); }
                        },
                        "Set"
                    }
                    button {
                        class: "btn small",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.start_timer(); }
                        },
                        "Start"
                    }
                    button {
                        class: "btn small",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.pause_timer(); }
                        },
                        "Pause"
                    }
                    button {
                        class: "btn small",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.clear_timer(); }
                        },
                        "Clear"
                    }
                }

                div { class: "controls",
                    label { class: "control-label", "Layout" }
                    button {
                        class: "btn small",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.set_stage_layout(StageLayout::Split); }
                        },
                        "Split"
                    }
                    button {
                        class: "btn small",
                        onclick: {
                            let app = app.clone();
                            move |_| { app.set_stage_layout(StageLayout::LiveOnly); }
                        },
                        "Live only"
                    }
                }
            }

            RecentProjects {
                items: recent.clone(),
                on_open: Some(EventHandler::new({
                    let app = app.clone();
                    move |path: String| {
                        match app.open_project(std::path::Path::new(&path)) {
                            Ok(()) => open_error.set(None),
                            Err(error) => {
                                tracing::error!(%error, "could not open project");
                                open_error.set(Some(error));
                            }
                        }
                    }
                })),
            }
            if let Some(message) = open_error() {
                p { class: "hint error", "{message}" }
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
                p { class: "keys",
                    "Space / → / PageDown next · ← / PageUp previous · Esc clear, "
                    "any navigation restores"
                }
                p { "Close any output, advance the show, then reopen it. "
                    "It must return to the live slide, not the slide it left." }
            }
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

                // Test-only: make the window we just created the active one so a
                // screenshot cannot land on somebody else's window. Presentation
                // outputs must never do this in production.
                if std::env::var("CJCRSG_FOCUS_OUTPUT").is_ok() {
                    context.set_focus();
                }

                tracing::info!(output = kind.label(), "output window opened");
            }
            Err(err) => {
                tracing::error!(output = kind.label(), ?err, "output window failed to open");
            }
        }
    });
}

/// FreeShow's controller bindings, delivered from the page so they work without
/// the window having focus ownership. The script is a separate file so the
/// browser-level test runs exactly what ships.
const KEY_SCRIPT: &str = include_str!("../assets/keys.js");
