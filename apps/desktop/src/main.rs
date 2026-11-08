//! Experiment 1 shell: one controller, N independent output windows, one engine.
//!
//! See `docs/experiments.md`. This binary exists to answer whether four
//! `VirtualDom`s can share one state publisher and survive being closed and
//! reopened. It is not the product.

mod app;
mod output;
mod runtime;
mod slide;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tracing::info!("starting experiment 1 shell");
    dioxus::launch(app::App);
}
