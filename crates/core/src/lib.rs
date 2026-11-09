//! Presentation domain, show engine and render state.
//!
//! This crate is deliberately free of Dioxus, WebView and window types: it must
//! be testable with `cargo test` and no display server. See `docs/architecture.md`.

#![forbid(unsafe_code)]

pub mod bundle;
pub mod clock;
pub mod domain;
pub mod engine;
pub mod hub;
pub mod input;
pub mod media;
pub mod render;
pub mod session;
pub mod shared;

pub use bundle::{bundle_media, BundleReport, BUNDLE_DIR};
pub use clock::{Clock, ManualClock, SystemClock};
pub use domain::{
    easing_css, MediaRef, Project, Show, Slide, SlideElement, SlideGroup, Transition,
    TransitionKind, EASINGS,
};
pub use engine::{Position, ShowEngine};
pub use hub::RenderHub;
pub use input::Command;
pub use media::{MediaAsset, MediaError, MediaKind, MediaOrigin};
pub use render::{
    RenderElement, RenderMedia, RenderSlide, RenderState, Revision, StageTimer, TransitionState,
};
pub use session::{RecentProject, Session, SessionStore, MAX_RECENT};
pub use shared::SharedEngine;
