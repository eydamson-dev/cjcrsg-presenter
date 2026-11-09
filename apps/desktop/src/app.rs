//! The controller window.
//!
//! Owns the command surface and the output registry. It is the only place that
//! creates windows — outputs never spawn other outputs.

use std::rc::Rc;
use std::time::Duration;

use dioxus::prelude::*;
use dioxus_desktop::{use_window, Config, DesktopContext, WindowBuilder, WindowCloseBehaviour};
use presenter_core::{Command, Revision, StageLayout};

use crate::drawer::{self, Drawer, DrawerContent, DrawerTab};
use crate::outline::FocusView;
use crate::output::{OutputProps, OutputRoot};
use crate::preview_pane::PreviewPane;
use crate::projects::{self, ProjectsPanel};
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
    // Subscribe the controller to its own 250 ms tick. Engine revisions, the
    // outputs' applied revisions and the project-browser file checks are not
    // Dioxus signals, so without this read they would only refresh on an
    // interaction.
    let _tick = tick();

    // Drawer state is local UI state: which tab, how tall, and how tall the
    // window says it may be. The remembered height lives in the session store.
    let mut drawer_tab = use_signal(|| DrawerTab::Shows);
    let mut drawer_height = use_signal(|| {
        drawer::remembered_open_height(
            app.drawer_remembered_height(),
            presenter_core::MAX_DRAWER_HEIGHT,
        )
    });
    let mut viewport = use_signal(|| Option::<drawer::Viewport>::None);

    // The page reports its inner height, the measured top-bar height and the
    // released drag height. The drag itself stays in the page so Rust is not
    // driven by pointer-move traffic.
    use_hook({
        let app = app.clone();
        move || {
            spawn(async move {
                let mut eval = document::eval(drawer::DRAWER_SCRIPT);
                while let Ok(raw) = eval.recv::<String>().await {
                    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
                        continue;
                    };
                    match value["kind"].as_str() {
                        Some("viewport") => {
                            let (Some(height), Some(top_bar)) =
                                (value["height"].as_u64(), value["top_bar"].as_u64())
                            else {
                                continue;
                            };
                            tracing::debug!(height, top_bar, "drawer viewport");
                            viewport.set(Some(drawer::Viewport {
                                inner_height: height.min(u32::MAX as u64) as u32,
                                top_bar_height: top_bar.min(u32::MAX as u64) as u32,
                            }));
                        }
                        Some("drawer_resize") => {
                            let Some(height) = value["height"].as_i64() else {
                                continue;
                            };
                            if let (Some(inner), Some(top_bar)) =
                                (value["inner_height"].as_u64(), value["top_bar"].as_u64())
                            {
                                viewport.set(Some(drawer::Viewport {
                                    inner_height: inner.min(u32::MAX as u64) as u32,
                                    top_bar_height: top_bar.min(u32::MAX as u64) as u32,
                                }));
                            }
                            let max = drawer::max_height(viewport());
                            let height = drawer::clamp_drag_height(height, max);
                            if height < drawer::COLLAPSE_THRESHOLD {
                                // A sub-80 release collapses; B5 does not use
                                // the collapsed height as the remembered one.
                                drawer_height.set(drawer::COLLAPSED_HEIGHT);
                            } else {
                                drawer_height.set(height);
                                app.set_drawer_height(height);
                            }
                        }
                        _ => {}
                    }
                }
            });
        }
    });

    // A hand-edited remembered height (or a resized window) can exceed what the
    // window can show; CSS clamps the rendered height to the space below the
    // measured top bar, and the handlers below collapse to what was visible.
    let visible_height = move || drawer_height().min(drawer::max_height(viewport()));

    // Global keyboard shortcuts, with FreeShow's bindings. The listener lives in
    // the page rather than on a focused element: an operator must not have to
    // click the window first, and focus can sit on any button.
    use_hook({
        let app = app.clone();
        move || {
            spawn(async move {
                let mut keys = document::eval(KEY_SCRIPT);
                while let Ok(key) = keys.recv::<String>().await {
                    if let Some(tab) = DrawerTab::from_shortcut(&key) {
                        drawer_tab.set(tab);
                        if drawer_height() < drawer::DEFAULT_OPEN_HEIGHT {
                            let max = drawer::max_height(viewport());
                            drawer_height.set(drawer::remembered_open_height(
                                app.drawer_remembered_height(),
                                max,
                            ));
                        }
                    } else if let Some(command) = Command::from_key(&key) {
                        app.apply(command);
                    }
                }
            });
        }
    });

    // Evidence convenience: a synthetic X11 click is not delivered to an
    // XWayland WebView, so a screenshot run can name the drawer or
    // project-browser action to take. The action is a real DOM click, through
    // the same handlers an operator uses. Debug builds only; never part of the
    // presentation path.
    use_hook(|| {
        if !cfg!(debug_assertions) {
            return;
        }
        if let Ok(action) = std::env::var("CJCRSG_DRAWER") {
            spawn(async move {
                tokio::time::sleep(Duration::from_millis(700)).await;
                for step in action.split(',') {
                    if let Some(ms) = step.strip_prefix("wait:") {
                        if let Ok(ms) = ms.parse::<u64>() {
                            tokio::time::sleep(Duration::from_millis(ms)).await;
                        }
                        continue;
                    }
                    let script = match step {
                        "tab:shows" => "document.querySelectorAll('.drawer-tab')[0]?.click()".to_string(),
                        "tab:media" => "document.querySelectorAll('.drawer-tab')[1]?.click()".to_string(),
                        "tab:audio" => "document.querySelectorAll('.drawer-tab')[2]?.click()".to_string(),
                        "tab:overlays" => "document.querySelectorAll('.drawer-tab')[3]?.click()".to_string(),
                        "tab:templates" => "document.querySelectorAll('.drawer-tab')[4]?.click()".to_string(),
                        "tab:scripture" => "document.querySelectorAll('.drawer-tab')[5]?.click()".to_string(),
                        "tab:calendar" => "document.querySelectorAll('.drawer-tab')[6]?.click()".to_string(),
                        "tab:functions" => "document.querySelectorAll('.drawer-tab')[7]?.click()".to_string(),
                        "collapse" | "open" => {
                            "document.querySelector('.drawer-top')?.click()".to_string()
                        }
                        "dblclick" => "document.querySelectorAll('.drawer-tab')[1]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))".to_string(),
                        step if step.starts_with("open:") => {
                            let name = js_string(step.trim_start_matches("open:"));
                            format!(
                                "(() => {{
                                    const row = [...document.querySelectorAll('.project-row')]
                                        .find((r) => r.querySelector('.name')?.textContent === {name});
                                    row?.querySelector('.project-open')?.click();
                                }})();"
                            )
                        }
                        step if step.starts_with("forget:") => {
                            let name = js_string(step.trim_start_matches("forget:"));
                            format!(
                                "(() => {{
                                    const row = [...document.querySelectorAll('.project-row')]
                                        .find((r) => r.querySelector('.name')?.textContent === {name});
                                    row?.querySelector('.project-forget')?.click();
                                }})();"
                            )
                        }
                        step if step.starts_with("play:") => {
                            let name = js_string(step.trim_start_matches("play:"));
                            format!(
                                "(() => {{
                                    const row = [...document.querySelectorAll('.drawer-content .outline-show')]
                                        .find((r) => r.querySelector('.name')?.textContent === {name});
                                    row?.querySelector('button')?.click();
                                }})();"
                            )
                        }
                        "portable" => "document.querySelector('.projects-foot .btn')?.click()".to_string(),
                        "top" => "document.querySelectorAll('.column, .drawer-content').forEach((el) => { el.scrollTop = 0; })".to_string(),
                        step if step.starts_with("drag:") => {
                            let target = step.trim_start_matches("drag:").parse::<u32>().unwrap_or(300);
                            format!(
                                "(() => {{
                                    const drawer = document.querySelector('.drawer');
                                    const strip = document.querySelector('.drawer-top');
                                    if (!drawer || !strip) return;
                                    const inner = Math.round(window.innerHeight);
                                    const startY = strip.getBoundingClientRect().top + 2;
                                    const startHeight = drawer.getBoundingClientRect().height;
                                    const offset = inner - startHeight - startY;
                                    const endY = inner - {target} - offset;
                                    const x = Math.round(window.innerWidth / 2);
                                    // Hit-test at the bar centre, which is over a
                                    // tab at ordinary widths; dispatch on the real
                                    // hit target, as a pointer would.
                                    const hit = document.elementFromPoint(x, startY) || strip;
                                    hit.dispatchEvent(new PointerEvent('pointerdown', {{
                                        bubbles: true, cancelable: true, button: 0,
                                        clientX: x, clientY: startY,
                                    }}));
                                    window.dispatchEvent(new PointerEvent('pointermove', {{
                                        bubbles: true, clientX: x, clientY: endY,
                                    }}));
                                    window.dispatchEvent(new PointerEvent('pointerup', {{
                                        bubbles: true, clientX: x, clientY: endY,
                                    }}));
                                }})();"
                            )
                        }
                        _ => String::new(),
                    };
                    if script.is_empty() {
                        continue;
                    }
                    let _ = document::eval(&script).await;
                    tokio::time::sleep(Duration::from_millis(300)).await;
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
    // Session and engine state are not Dioxus signals. Bumping this after an
    // open or a forget is what tells the panel to re-read them.
    let mut projects_revision = use_signal(|| 0u64);
    let mut message_text = use_signal(String::new);
    let mut timer_minutes = use_signal(|| 5u64);
    // Test-only: start in focus mode so the layout can be screenshotted.
    let mut focus = use_signal(|| std::env::var("CJCRSG_FOCUS").is_ok());
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

    // Column widths live in the page while dragging and are persisted on
    // release; the grid reads them from these custom properties.
    use_hook({
        let app = app.clone();
        move || {
            spawn(async move {
                let mut eval = document::eval(RESIZE_SCRIPT);
                while let Ok(raw) = eval.recv::<String>().await {
                    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
                        continue;
                    };
                    let left = value["left"].as_u64().unwrap_or(280) as u32;
                    let right = value["right"].as_u64().unwrap_or(360) as u32;
                    app.set_column_widths(left, right);
                }
            });
        }
    });

    let (left_width, right_width) = app.column_widths();
    let project_name = app.project_name();
    let slide = app.slide();
    let outline = app.outline();

    // Re-read the session list whenever an open or forget has changed it; the
    // read is also what subscribes this scope to the signal.
    let _generation = projects_revision();
    let open_path = app.project_path();
    let project_rows = projects::build(
        open_path
            .as_deref()
            .map(|path| (path, project_name.as_str())),
        &recent,
    );
    let project_path_text = open_path.as_ref().map(|path| path.display().to_string());

    let (drawer_media, drawer_audio) = crate::media_panel::split(app.media());
    let drawer_content = DrawerContent {
        outline: outline.clone(),
        live_show: app.current_show(),
        media: drawer_media,
        audio: drawer_audio,
    };

    let app_select = app.clone();
    let select_tab = move |tab: DrawerTab| {
        if drawer_height() <= drawer::COLLAPSED_HEIGHT {
            let max = drawer::max_height(viewport());
            drawer_height.set(drawer::remembered_open_height(
                app_select.drawer_remembered_height(),
                max,
            ));
        }
        if drawer_tab() != tab {
            drawer_tab.set(tab);
        }
    };

    let app_toggle = app.clone();
    let toggle_drawer = move |_| {
        if drawer_height() <= drawer::COLLAPSED_HEIGHT {
            let max = drawer::max_height(viewport());
            drawer_height.set(drawer::remembered_open_height(
                app_toggle.drawer_remembered_height(),
                max,
            ));
        } else {
            app_toggle.set_drawer_height(visible_height());
            drawer_height.set(drawer::COLLAPSED_HEIGHT);
        }
    };

    let app_collapse = app.clone();
    let collapse_drawer = move |_tab: DrawerTab| {
        if drawer_height() > drawer::COLLAPSED_HEIGHT {
            app_collapse.set_drawer_height(visible_height());
            drawer_height.set(drawer::COLLAPSED_HEIGHT);
        }
    };

    let app_play = app.clone();
    let play_show = move |index: usize| {
        app_play.go_to_show(index);
    };

    // The browser's open uses the same path as the CLI/open button. A failed
    // open keeps the list and shows the error inline under it.
    let app_open_row = app.clone();
    let open_row = move |path: String| match app_open_row.open_project(std::path::Path::new(&path))
    {
        Ok(()) => {
            open_error.set(None);
            projects_revision += 1;
        }
        Err(error) => {
            tracing::error!(%error, "could not open project");
            open_error.set(Some(error));
        }
    };

    let app_forget_row = app.clone();
    let forget_row = move |path: String| {
        if app_forget_row.forget_recent(&path) {
            projects_revision += 1;
        }
    };

    let app_bundle = app.clone();
    let make_portable = move |_| match app_bundle.bundle_media() {
        Ok(summary) => bundle_status.set(summary),
        Err(error) => bundle_status.set(error),
    };

    rsx! {
        document::Style { {crate::assets::MAIN_CSS} }
        document::Title { "CJCRSG Presenter" }

        div { class: "controller",

            header { class: "topbar",
                div { class: "brand",
                    h1 { "CJCRSG Presenter" }
                    p { class: "subtitle", "{project_name}" }
                }

                div { class: "topbar-commands",
                    button {
                        class: "btn small",
                        onclick: { let app = app.clone(); move |_| { app.previous_slide(); } },
                        "◀"
                    }
                    button {
                        class: "btn small primary",
                        onclick: { let app = app.clone(); move |_| { app.next_slide(); } },
                        "▶"
                    }
                    button {
                        class: "btn small",
                        onclick: { let app = app.clone(); move |_| { app.first_slide(); } },
                        "First"
                    }
                    button {
                        class: "btn small",
                        onclick: { let app = app.clone(); move |_| { app.apply(Command::Clear); } },
                        "Clear"
                    }
                    button {
                        class: "btn small",
                        onclick: { let app = app.clone(); move |_| { app.apply(Command::Restore); } },
                        "Restore"
                    }
                    span { class: "topbar-divider" }
                    button {
                        class: "btn small",
                        onclick: { let app = app.clone(); move |_| { app.previous_section(); } },
                        "Section ◀"
                    }
                    button {
                        class: "btn small",
                        onclick: { let app = app.clone(); move |_| { app.next_section(); } },
                        "Section ▶"
                    }
                }

                div { class: "topbar-actions",
                    span { class: "readout-inline", "rev {revision} · {position} / {total}" }
                    button {
                        class: "btn",
                        onclick: move |_| focus.toggle(),
                        if focus() { "Exit focus" } else { "Focus" }
                    }
                }
            }

            div {
                class: "workspace",
                style: "--left-w: {left_width}px; --right-w: {right_width}px;",

                div { class: "workspace-grid",
                    aside { class: "column left",
                        ProjectsPanel {
                            rows: project_rows,
                            on_open: Some(EventHandler::new(open_row)),
                            on_forget: Some(EventHandler::new(forget_row)),
                            project_path: project_path_text,
                            on_bundle: Some(EventHandler::new(make_portable)),
                            bundle_status: bundle_status(),
                            error: open_error(),
                        }
                    }

                    div { class: "resize-handle", "data-side": "left" }

                    main { class: "column center",
                        if focus() {
                            FocusView {
                                items: outline.clone(),
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
                        } else {
                            PreviewPane {
                                slide: slide,
                                slide_id: slide_id.clone(),
                                position,
                                total,
                            }
                        }
                    }

                    div { class: "resize-handle", "data-side": "right" }

                    aside { class: "column right",
                        section { class: "panel",
                            h2 { "Stage" }
                            p { class: "hint", "Shown on the stage display, never on an audience output." }

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
                                    onclick: { let app = app.clone(); move |_| { app.set_timer(timer_minutes() * 60); } },
                                    "Set"
                                }
                                button {
                                    class: "btn small",
                                    onclick: { let app = app.clone(); move |_| { app.start_timer(); } },
                                    "Start"
                                }
                                button {
                                    class: "btn small",
                                    onclick: { let app = app.clone(); move |_| { app.pause_timer(); } },
                                    "Pause"
                                }
                                button {
                                    class: "btn small",
                                    onclick: { let app = app.clone(); move |_| { app.clear_timer(); } },
                                    "Clear"
                                }
                            }

                            div { class: "controls",
                                label { class: "control-label", "Layout" }
                                button {
                                    class: "btn small",
                                    onclick: { let app = app.clone(); move |_| { app.set_stage_layout(StageLayout::Split); } },
                                    "Split"
                                }
                                button {
                                    class: "btn small",
                                    onclick: { let app = app.clone(); move |_| { app.set_stage_layout(StageLayout::LiveOnly); } },
                                    "Live only"
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

                        p { class: "keys",
                            "Space / → / PageDown next · ← / PageUp previous · Esc clear"
                        }
                    }
                }
            }

            Drawer {
                active: drawer_tab(),
                height: drawer_height(),
                content: drawer_content,
                on_select: EventHandler::new(select_tab),
                on_toggle: EventHandler::new(toggle_drawer),
                on_collapse: EventHandler::new(collapse_drawer),
                on_play_show: EventHandler::new(play_show),
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

/// Quote a value as a JavaScript string literal for the evidence hook.
///
/// The hook only receives operator-supplied names, never markup, but escaping
/// the quote and the backslash keeps a name from becoming code.
fn js_string(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('\'');
    for character in value.chars() {
        match character {
            '\\' => out.push_str("\\\\"),
            '\'' => out.push_str("\\'"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            _ => out.push(character),
        }
    }
    out.push('\'');
    out
}

/// Drag the two handles between the columns and report the widths to Rust.
///
/// Delegated from the document and guarded, because the handles are re-rendered
/// when focus mode is toggled and a per-element listener would be lost.
const RESIZE_SCRIPT: &str = r#"
    (() => {
        if (window.__cjcpResize) return;
        window.__cjcpResize = true;
        const px = (workspace, name, fallback) => {
            const value = parseInt(getComputedStyle(workspace).getPropertyValue(name));
            return Number.isFinite(value) ? value : fallback;
        };
        document.addEventListener('pointerdown', (event) => {
            const handle = event.target.closest && event.target.closest('.resize-handle');
            if (!handle) return;
            const workspace = document.querySelector('.workspace');
            if (!workspace) return;
            event.preventDefault();

            const startX = event.clientX;
            const startLeft = px(workspace, '--left-w', 280);
            const startRight = px(workspace, '--right-w', 360);
            const side = handle.dataset.side;

            const move = (ev) => {
                const dx = ev.clientX - startX;
                if (side === 'left') {
                    const width = Math.min(480, Math.max(200, startLeft + dx));
                    workspace.style.setProperty('--left-w', width + 'px');
                } else {
                    const width = Math.min(520, Math.max(260, startRight - dx));
                    workspace.style.setProperty('--right-w', width + 'px');
                }
            };
            const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                dioxus.send(JSON.stringify({
                    left: px(workspace, '--left-w', 280),
                    right: px(workspace, '--right-w', 360),
                }));
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
        });
    })();
"#;

/// FreeShow's controller bindings, delivered from the page so they work without
/// the window having focus ownership. The script is a separate file so the
/// browser-level test runs exactly what ships.
const KEY_SCRIPT: &str = include_str!("../assets/keys.js");
