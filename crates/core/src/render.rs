//! What an output window needs *now*.
//!
//! Never persisted. Produced by projecting the domain model, and consumed by one
//! `VirtualDom` per output. See `docs/architecture.md#state-model`.

use serde::{Deserialize, Serialize};

pub use crate::domain::TransitionKind;

pub type Revision = u64;

/// The complete, self-sufficient state of one presentation instant.
///
/// A window that receives only the newest value can render correctly: it needs
/// no history. That property is what makes a closed output recoverable.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RenderState {
    /// Monotonic. Increments on every meaningful change, never on a timer.
    pub revision: Revision,
    pub show_id: String,
    pub slide_id: String,
    pub slide: RenderSlide,
    /// Operator notes for the live slide. Empty when there are none.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub notes: String,
    /// The slide that follows the current one, for a stage display.
    ///
    /// Part of the state rather than something a stage computes, because the
    /// stage must never disagree with the engine about what comes next.
    pub next: Option<RenderSlide>,
    /// A message for the stage display only. Never rendered on an audience
    /// output: an operator note to the team is not a slide.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// The stage countdown, if one is set.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timer: Option<StageTimer>,
    /// Describes the change that produced `revision`, if any.
    ///
    /// A renderer animates only when it already knows a *previous* revision. On
    /// first mount it renders directly, so reopening a window never replays a
    /// transition the congregation already saw.
    pub transition: Option<TransitionState>,
}

/// The stage countdown, as of the moment this state was produced.
///
/// The stage display ticks locally between publications; this value is the
/// correction it starts from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct StageTimer {
    pub remaining_ms: u64,
    pub running: bool,
}

/// A slide reduced to everything the renderer needs, with no lookups required.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RenderSlide {
    /// CSS background value (colour, gradient or `url(...)`).
    pub background: Option<String>,
    pub elements: Vec<RenderElement>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RenderElement {
    pub id: String,
    pub class_name: String,
    pub text: String,
    pub style: String,
    /// An image, video or audio item. `None` means the element renders text.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media: Option<RenderMedia>,
}

/// Media ready for a renderer: no project lookups, no path rules.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RenderMedia {
    pub kind: crate::media::MediaKind,
    /// An absolute `file://` URL the WebView can load.
    pub src: String,
    pub looped: bool,
    pub muted: bool,
    /// False when the output is blanked. The element is not rendered then, but
    /// the state says why, so a future pause/resume does not guess.
    pub playing: bool,
    /// Milliseconds into the clip. A reopened output seeks here instead of
    /// restarting the video the congregation is already watching.
    pub position_ms: u64,
}

/// How the state that produced `revision` should animate.
///
/// The transition *kind* lives in [`crate::domain`] because it is persisted
/// project data; this type is the per-revision instruction to a renderer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TransitionState {
    /// The revision this transition belongs to. Not the revision it starts from.
    pub revision: Revision,
    pub kind: TransitionKind,
    pub duration_ms: u32,
    /// The authored easing name (`sine`, `cubic`, …). Kept as a name, not a
    /// resolved CSS curve, so the state stays renderer-neutral; a renderer
    /// resolves it with [`crate::domain::easing_css`].
    pub easing: String,
}

impl TransitionState {
    /// The authored transition this state describes.
    pub fn spec(&self) -> crate::domain::Transition {
        crate::domain::Transition {
            kind: self.kind,
            duration_ms: self.duration_ms,
            easing: self.easing.clone(),
            extra: Default::default(),
        }
    }
}

impl RenderSlide {
    pub fn is_blank(&self) -> bool {
        self.elements.is_empty() && self.background.is_none()
    }
}

impl RenderState {
    /// State for "nothing loaded". Outputs show black rather than an error.
    pub fn blank(revision: Revision) -> Self {
        Self {
            revision,
            ..Self::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_transition_round_trips_by_name() {
        for kind in TransitionKind::ALL {
            let json = serde_json::to_string(&kind).unwrap();
            let back: TransitionKind = serde_json::from_str(&json).unwrap();
            assert_eq!(back, kind, "{json}");
        }
    }

    #[test]
    fn names_match_freeshow_spelling() {
        assert_eq!(
            serde_json::to_string(&TransitionKind::None).unwrap(),
            "\"none\""
        );
        assert_eq!(
            serde_json::to_string(&TransitionKind::Crossfade).unwrap(),
            "\"crossfade\""
        );
    }

    #[test]
    fn none_has_no_animation() {
        assert!(TransitionKind::None.animation().is_none());
        assert_eq!(TransitionKind::Slide.animation(), Some("slide"));
    }
}
