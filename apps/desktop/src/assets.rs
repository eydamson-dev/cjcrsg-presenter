//! Styles are embedded at compile time.
//!
//! `document::Stylesheet { href: asset!(...) }` resolves through the asset
//! protocol, which needs the Dioxus CLI to link the file at runtime. Embedding
//! the same file keeps `cargo run` and the packaged build identical, and a
//! missing stylesheet becomes a compile error instead of a silently unstyled
//! window.

pub const MAIN_CSS: &str = include_str!("../assets/main.css");
