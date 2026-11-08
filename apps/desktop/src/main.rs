//! Experiment 1 shell: one controller, N independent output windows, one engine.
//!
//! See `docs/experiments.md`. This binary exists to answer whether four
//! `VirtualDom`s can share one state publisher and survive being closed and
//! reopened. It is not the product.

mod app;
mod assets;
mod cli;
mod output;
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
