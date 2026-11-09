//! Experiment 1 shell: one controller, N independent output windows, one engine.
//!
//! See `docs/experiments.md`. This binary exists to answer whether four
//! `VirtualDom`s can share one state publisher and survive being closed and
//! reopened. It is not the product.

mod app;
mod assets;
mod cli;
mod output;
mod recent;
mod render;
mod runtime;
mod slide;
mod smoke;

use cli::Action;
use dioxus_desktop::{Config, LogicalSize, WindowBuilder};

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let args: Vec<String> = std::env::args().skip(1).collect();

    let project = match cli::run(&args) {
        Ok(Action::Handled) => return,
        Ok(Action::Gui(project)) => project,
        Ok(Action::Serve(port)) => {
            run_server(port);
            return;
        }
        Ok(Action::Render {
            project,
            out,
            layout,
            slide,
            transition,
            pause,
        }) => {
            render_to_file(&project, &out, layout, slide, transition, pause);
            return;
        }
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(2);
        }
    };

    if let Some(path) = project {
        // The runtime reads this on construction; keeps the GUI path unaware of
        // where the project came from.
        std::env::set_var("CJCRSG_PROJECT", path);
    }

    tracing::info!("starting experiment 1 shell");

    if std::env::var("CJCRSG_REMOTE").as_deref() != Ok("0") {
        start_remote();
    }

    // `CJCRSG_SMOKE=1` runs Experiment 1 unattended and exits with its verdict.
    if std::env::var("CJCRSG_SMOKE").is_ok() {
        dioxus::LaunchBuilder::desktop()
            .with_cfg(desktop_config())
            .launch(smoke::Smoke);
    } else {
        dioxus::LaunchBuilder::desktop()
            .with_cfg(desktop_config())
            .launch(app::App);
    }
}

/// Render a project to HTML. No window, no display server.
fn render_to_file(
    project: &std::path::Path,
    out: &std::path::Path,
    layout: render::Layout,
    slide: Option<usize>,
    requested: Option<presenter_core::Transition>,
    pause: Option<u32>,
) {
    if layout == render::Layout::Recent {
        let session = runtime::session_store().load();
        let html = render::render_recent(&session);
        if let Err(error) = std::fs::write(out, html) {
            eprintln!("cannot write {}: {error}", out.display());
            std::process::exit(1);
        }
        println!("rendered recent projects -> {}", out.display());
        return;
    }

    let document = match presenter_compat::cjcp::read(project) {
        Ok(document) => document,
        Err(error) => {
            eprintln!("cannot read {}: {error}", project.display());
            std::process::exit(1);
        }
    };

    let mut engine = presenter_core::ShowEngine::new(document.project);
    if let Some(root) = project.parent() {
        engine = engine.with_media_root(root);
    }
    if let Some(index) = slide {
        engine.go_to_index(index);
    }

    // A slide's own timing is what an imported project carries, so it is the
    // default for evidence renders; `--transition` overrides it.
    let transition = requested.unwrap_or_else(|| {
        engine
            .state()
            .transition
            .as_ref()
            .map(|transition| transition.spec())
            .unwrap_or_else(presenter_core::Transition::none)
    });

    let shared = presenter_core::SharedEngine::new(engine);
    let html = render::render(&shared, layout, transition, pause);
    if let Err(error) = std::fs::write(out, html) {
        eprintln!("cannot write {}: {error}", out.display());
        std::process::exit(1);
    }
    println!("rendered {} -> {}", project.display(), out.display());
}

/// Blocking headless server for tests and for a machine with no display.
fn run_server(port: u16) {
    let engine = runtime::shared_engine();
    let runtime = match tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            eprintln!("could not start runtime: {error}");
            std::process::exit(1);
        }
    };

    println!("serving remote on http://127.0.0.1:{port}");
    if let Err(error) = runtime.block_on(presenter_remote::serve(engine, port)) {
        eprintln!("server stopped: {error}");
        std::process::exit(1);
    }
}

/// Run the remote control server on its own thread and runtime.
///
/// A separate runtime keeps the server's scheduling from competing with the
/// UI's, and a separate thread keeps a bind failure from taking down the app.
fn start_remote() {
    let port: u16 = std::env::var("CJCRSG_REMOTE_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(presenter_remote::DEFAULT_PORT);
    let engine = runtime::shared_engine();

    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build();

        match runtime {
            Ok(runtime) => {
                if let Err(error) = runtime.block_on(presenter_remote::serve(engine, port)) {
                    tracing::error!(port, %error, "remote control server stopped");
                }
            }
            Err(error) => tracing::error!(%error, "could not start the remote runtime"),
        }
    });
}

/// The controller is the operator's window: it needs to be readable, and it is
/// not the presentation surface.
fn desktop_config() -> Config {
    Config::new().with_window(
        WindowBuilder::new()
            .with_title("CJCRSG Presenter")
            .with_inner_size(LogicalSize::new(980.0, 780.0))
            .with_min_inner_size(LogicalSize::new(720.0, 540.0)),
    )
}
