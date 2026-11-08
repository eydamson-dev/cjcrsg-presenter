//! What an output window needs *now*.
//!
//! Never persisted. Produced by projecting the domain model, and consumed by one
//! `VirtualDom` per output. See `docs/architecture.md#state-model`.

use serde::{Deserialize, Serialize};

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
    /// Describes the change that produced `revision`, if any.
    ///
    /// A renderer animates only when it already knows a *previous* revision. On
    /// first mount it renders directly, so reopening a window never replays a
    /// transition the congregation already saw.
    pub transition: Option<TransitionState>,
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
}

/// The transitions FreeShow offers, so a project's transition survives import.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TransitionKind {
    None,
    Blur,
    #[default]
    Fade,
    Crossfade,
    Fly,
    Scale,
    Slide,
    Spin,
}

impl TransitionKind {
    /// The CSS animation stem, or `None` for an instant cut.
    pub fn animation(self) -> Option<&'static str> {
        match self {
            TransitionKind::None => None,
            TransitionKind::Blur => Some("blur"),
            TransitionKind::Fade => Some("fade"),
            TransitionKind::Crossfade => Some("crossfade"),
            TransitionKind::Fly => Some("fly"),
            TransitionKind::Scale => Some("scale"),
            TransitionKind::Slide => Some("slide"),
            TransitionKind::Spin => Some("spin"),
        }
    }

    pub const ALL: [TransitionKind; 8] = [
        TransitionKind::None,
        TransitionKind::Blur,
        TransitionKind::Fade,
        TransitionKind::Crossfade,
        TransitionKind::Fly,
        TransitionKind::Scale,
        TransitionKind::Slide,
        TransitionKind::Spin,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TransitionState {
    /// The revision this transition belongs to. Not the revision it starts from.
    pub revision: Revision,
    pub kind: TransitionKind,
    pub duration_ms: u32,
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
