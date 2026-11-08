//! Experiment 1 shell: one controller, N independent output windows, one engine.
//!
//! See `docs/experiments.md`. This binary exists to answer whether four
//! `VirtualDom`s can share one state publisher and survive being closed and
//! reopened. It is not the product.

mod app;
mod output;
mod runtime;
mod slide;
mod smoke;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tracing::info!("starting experiment 1 shell");

    // `CJCRSG_SMOKE=1` runs Experiment 1 unattended and exits with its verdict.
    if std::env::var("CJCRSG_SMOKE").is_ok() {
        dioxus::launch(smoke::Smoke);
    } else {
        dioxus::launch(app::App);
    }
}
