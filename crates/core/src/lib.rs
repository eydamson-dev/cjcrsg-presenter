//! Presentation domain, show engine and render state.
//!
//! This crate is deliberately free of Dioxus, WebView and window types: it must
//! be testable with `cargo test` and no display server. See `docs/architecture.md`.

#![forbid(unsafe_code)]

pub mod domain;
pub mod engine;
pub mod hub;
pub mod media;
pub mod render;
pub mod shared;

pub use domain::{Project, Show, Slide, SlideElement, SlideGroup};
pub use engine::{Position, ShowEngine};
pub use hub::RenderHub;
pub use media::{MediaAsset, MediaError, MediaKind, MediaOrigin};
pub use render::{
    RenderElement, RenderSlide, RenderState, Revision, TransitionKind, TransitionState,
};
pub use shared::SharedEngine;
