//! What a project *means*.
//!
//! These types are persisted and must stay compatible with FreeShow's formats.
//! They are not what an output window renders — that is [`crate::render`].

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type Id = String;

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

/// The easing curves FreeShow offers, spelled as it spells them.
///
/// Held as a name rather than an enum: projects carry strings, and a curve we do
/// not model (`expo`, `quad`) must still load and round-trip. Anything unknown
/// resolves to sine, which is FreeShow's own default.
pub const EASINGS: [&str; 7] = [
    "linear", "back", "sine", "circ", "cubic", "elastic", "bounce",
];

/// Resolve an authored easing name to a CSS timing function.
///
/// FreeShow's curves are Svelte's *inOut* functions. `linear`, `sine`, `cubic`,
/// `circ` and `back` map to exact cubic-béziers. `elastic` and `bounce` cannot
/// be expressed by one cubic-bézier; they are approximated by an overshooting
/// curve, recorded as DEV-011.
pub fn easing_css(name: &str) -> &'static str {
    match name {
        "linear" => "linear",
        "back" => "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "cubic" => "cubic-bezier(0.65, 0, 0.35, 1)",
        "circ" => "cubic-bezier(0.85, 0, 0.15, 1)",
        "elastic" => "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
        "bounce" => "cubic-bezier(0.34, 1.56, 0.64, 1)",
        // "sine", and anything authored by a build we do not know.
        _ => "cubic-bezier(0.37, 0, 0.63, 1)",
    }
}

/// When and how a slide comes to air, as authored.
///
/// Field names follow FreeShow so a `.show`'s transition object deserialises
/// directly, and so fields we do not model (`custom`, `fadeInOffset`) are kept
/// in `extra` rather than dropped.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transition {
    #[serde(rename = "type", alias = "kind", default)]
    pub kind: TransitionKind,
    /// Milliseconds.
    #[serde(
        rename = "duration",
        alias = "duration_ms",
        default = "default_duration"
    )]
    pub duration_ms: u32,
    #[serde(default = "default_easing")]
    pub easing: String,
    /// Fields we do not model yet, preserved verbatim on save.
    #[serde(flatten, default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extra: BTreeMap<String, Value>,
}

fn default_duration() -> u32 {
    500
}

fn default_easing() -> String {
    "sine".to_string()
}

impl Default for Transition {
    fn default() -> Self {
        Self {
            kind: TransitionKind::Fade,
            duration_ms: default_duration(),
            easing: default_easing(),
            extra: BTreeMap::new(),
        }
    }
}

impl Transition {
    /// An instant cut, for places where a transition would be misleading.
    pub fn none() -> Self {
        Self {
            kind: TransitionKind::None,
            duration_ms: 0,
            easing: "linear".to_string(),
            extra: BTreeMap::new(),
        }
    }
}

/// A loaded project: the unit a user opens and saves.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Project {
    pub id: Id,
    pub name: String,
    pub shows: Vec<Show>,
    /// Media referenced anywhere in the project. Paths are relative for
    /// bundled assets; see `crate::media`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub media: Vec<crate::media::MediaAsset>,
    /// Fields we do not model yet, preserved verbatim on save.
    #[serde(flatten, default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extra: BTreeMap<String, Value>,
}

/// One presentable show.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Show {
    pub id: Id,
    pub name: String,
    pub groups: Vec<SlideGroup>,
    /// Media referenced by this show's slides.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub media: Vec<crate::media::MediaAsset>,
    /// Fields we do not model yet, preserved verbatim on save.
    #[serde(flatten, default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extra: BTreeMap<String, Value>,
}

/// A run of slides that belong together (a song verse set, a scripture set).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SlideGroup {
    pub id: Id,
    pub name: String,
    pub slides: Vec<Slide>,
    /// Fields we do not model yet, preserved verbatim on save.
    #[serde(flatten, default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extra: BTreeMap<String, Value>,
}

/// One screenful of content.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Slide {
    pub id: Id,
    pub name: String,
    /// Operator notes, shown on a stage display, never on the audience output.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub notes: String,
    pub elements: Vec<SlideElement>,
    /// How this slide comes to air. `None` means the project default applies —
    /// FreeShow resolves slide → style → global, and we model the two ends.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transition: Option<Transition>,
    /// Fields we do not model yet, preserved verbatim on save.
    #[serde(flatten, default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extra: BTreeMap<String, Value>,
}

/// A file a slide element shows or plays.
///
/// Imported FreeShow items carry the path directly (`item.src`), so an element
/// does not need a lookup into the show's media map.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaRef {
    /// Forward slashes, as stored by the project.
    pub path: String,
    pub kind: crate::media::MediaKind,
    pub origin: crate::media::MediaOrigin,
    #[serde(default)]
    pub looped: bool,
    /// Muted by default: an output must start playing without a click, and
    /// browsers only autoplay muted media. A project that says otherwise wins.
    #[serde(default = "default_muted")]
    pub muted: bool,
}

fn default_muted() -> bool {
    true
}

/// A positioned piece of content on a slide.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SlideElement {
    pub id: Id,
    pub text: String,
    /// Class the renderer applies; the CSS contract depends on it.
    pub class_name: String,
    /// Inline style, already resolved. Empty means none.
    pub style: String,
    /// Set for an image, video or audio item. `None` means text.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media: Option<MediaRef>,
    /// Fields we do not model yet, preserved verbatim on save.
    #[serde(flatten, default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extra: BTreeMap<String, Value>,
}

impl Show {
    /// Every slide in display order, with the group it belongs to.
    pub fn slides(&self) -> impl Iterator<Item = (&SlideGroup, &Slide)> {
        self.groups
            .iter()
            .flat_map(|group| group.slides.iter().map(move |slide| (group, slide)))
    }

    pub fn slide_count(&self) -> usize {
        self.groups.iter().map(|group| group.slides.len()).sum()
    }
}

impl Project {
    /// Every slide in the project, in presentation order.
    pub fn slides(&self) -> impl Iterator<Item = (&Show, &SlideGroup, &Slide)> {
        self.shows.iter().flat_map(|show| {
            show.slides()
                .map(move |(group, slide)| (show, group, slide))
        })
    }

    pub fn slide_count(&self) -> usize {
        self.shows.iter().map(Show::slide_count).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.slide_count() == 0
    }

    /// Make sure every show's media also appears in the project list.
    ///
    /// A show imported on its own carries its own media; the project list is the
    /// view that operators and packaging use, so it must not be short. Existing
    /// entries win, and ids are unique.
    pub fn collect_media(&mut self) {
        let mut merged: Vec<crate::media::MediaAsset> = std::mem::take(&mut self.media);
        for show in &self.shows {
            for asset in &show.media {
                if !merged.iter().any(|existing| existing.id == asset.id) {
                    merged.push(asset.clone());
                }
            }
        }
        self.media = merged;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_transition_reads_freeshows_shape() {
        let json = r#"{"type":"slide","duration":1200,"easing":"cubic",
                       "custom":{"direction":"bottom_top"},"fadeInOffset":30}"#;
        let transition: Transition = serde_json::from_str(json).unwrap();
        assert_eq!(transition.kind, TransitionKind::Slide);
        assert_eq!(transition.duration_ms, 1200);
        assert_eq!(transition.easing, "cubic");
        assert!(
            transition.extra.contains_key("custom"),
            "fields we do not model are kept"
        );

        let out = serde_json::to_string(&transition).unwrap();
        assert!(out.contains("\"fadeInOffset\":30"), "{out}");
        assert!(out.contains("bottom_top"), "{out}");
    }

    #[test]
    fn a_transition_written_by_us_can_be_read_back() {
        let transition = Transition {
            kind: TransitionKind::Spin,
            duration_ms: 250,
            easing: "back".to_string(),
            ..Default::default()
        };
        let json = serde_json::to_string(&transition).unwrap();
        assert_eq!(
            serde_json::from_str::<Transition>(&json).unwrap(),
            transition
        );
    }

    #[test]
    fn an_unknown_easing_still_loads_and_round_trips() {
        let json = r#"{"type":"fade","duration":400,"easing":"expo"}"#;
        let transition: Transition = serde_json::from_str(json).unwrap();
        assert_eq!(transition.easing, "expo");
        assert_eq!(
            serde_json::to_string(&transition).unwrap(),
            json,
            "a curve we do not model must survive"
        );
    }

    #[test]
    fn easing_names_resolve_to_css_curves() {
        assert_eq!(easing_css("linear"), "linear");
        assert_eq!(easing_css("sine"), "cubic-bezier(0.37, 0, 0.63, 1)");
        assert!(
            easing_css("cubic").starts_with("cubic-bezier"),
            "known curves are béziers"
        );
        // Unknown curves degrade to FreeShow's default rather than to `linear`
        // by accident or an invalid value the browser would ignore.
        assert_eq!(easing_css("expo"), easing_css("sine"));
    }

    #[test]
    fn collecting_media_merges_shows_without_dropping_project_entries() {
        use crate::media::{MediaAsset, MediaKind};

        let mut project = Project {
            media: vec![MediaAsset::new("keep", MediaKind::Image, "media/keep.png")],
            shows: vec![Show {
                media: vec![
                    MediaAsset::new("keep", MediaKind::Image, "media/keep.png"),
                    MediaAsset::new("new", MediaKind::Audio, "media/new.mp3"),
                ],
                ..Default::default()
            }],
            ..Default::default()
        };

        project.collect_media();
        let ids: Vec<&str> = project.media.iter().map(|a| a.id.as_str()).collect();
        assert_eq!(ids, ["keep", "new"], "deduped, order preserved");
    }

    #[test]
    fn the_default_is_freeshows_default_text_transition() {
        let transition = Transition::default();
        assert_eq!(transition.kind, TransitionKind::Fade);
        assert_eq!(transition.duration_ms, 500);
        assert_eq!(transition.easing, "sine");
    }
}
