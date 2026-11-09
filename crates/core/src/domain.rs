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
/// `circ` and `back` map to exact cubic-béziers. `elastic` and `bounce` cannot be
/// expressed by one cubic-bézier, so they are sampled into CSS `linear()` lists
/// by `parity/tools/generate_easing.py` (101 points; worst error 0.7 % and 1.3 %
/// against the exact functions). The strings below are that tool's output.
const ELASTIC_CSS: &str = "linear(0, 0.0002, 0.0005, 0.0007, 0.0008, 0.0009, 0.0007, 0.0004, -0.0002, -0.0009, -0.0016, -0.0022, -0.0025, -0.0024, -0.0018, -0.0006, 0.0011, 0.0032, 0.0052, 0.0068, 0.0074, 0.0067, 0.0044, 0.0004, -0.005, -0.011, -0.0167, -0.0206, -0.0214, -0.018, -0.0097, 0.0034, 0.0199, 0.0374, 0.0527, 0.0617, 0.0606, 0.0464, 0.0178, -0.0237, -0.0735, -0.1236, -0.1636, -0.1819, -0.1677, -0.1135, -0.018, 0.1117, 0.2594, 0.3995, 0.5, 0.6005, 0.7406, 0.8883, 1.018, 1.1135, 1.1677, 1.1819, 1.1636, 1.1236, 1.0735, 1.0237, 0.9822, 0.9536, 0.9394, 0.9383, 0.9473, 0.9626, 0.9801, 0.9966, 1.0097, 1.018, 1.0214, 1.0206, 1.0167, 1.011, 1.005, 0.9996, 0.9956, 0.9933, 0.9926, 0.9932, 0.9948, 0.9968, 0.9989, 1.0006, 1.0018, 1.0024, 1.0025, 1.0022, 1.0016, 1.0009, 1.0002, 0.9996, 0.9993, 0.9991, 0.9992, 0.9993, 0.9995, 0.9998, 1)";
const BOUNCE_CSS: &str = "linear(0, 0.0086, 0.013, 0.013, 0.0086, 0, 0.0184, 0.032, 0.0408, 0.0448, 0.0439, 0.0382, 0.0276, 0.0123, 0.0118, 0.0416, 0.0679, 0.0905, 0.1094, 0.1248, 0.1365, 0.1446, 0.149, 0.1499, 0.1471, 0.1406, 0.1306, 0.1169, 0.0995, 0.0786, 0.054, 0.0258, 0.01, 0.0629, 0.1128, 0.1597, 0.2035, 0.2444, 0.2822, 0.317, 0.3488, 0.3775, 0.4032, 0.4259, 0.4456, 0.4622, 0.4758, 0.4864, 0.494, 0.4985, 0.5, 0.5015, 0.506, 0.5136, 0.5242, 0.5378, 0.5545, 0.5741, 0.5968, 0.6225, 0.6512, 0.683, 0.7178, 0.7556, 0.7965, 0.8403, 0.8872, 0.9371, 0.9901, 0.9742, 0.946, 0.9214, 0.9005, 0.8831, 0.8694, 0.8594, 0.8529, 0.8501, 0.851, 0.8554, 0.8635, 0.8752, 0.8906, 0.9095, 0.9321, 0.9584, 0.9882, 0.9877, 0.9724, 0.9618, 0.9561, 0.9552, 0.9592, 0.968, 0.9816, 1, 0.9914, 0.987, 0.987, 0.9914, 1)";

pub fn easing_css(name: &str) -> &'static str {
    match name {
        "linear" => "linear",
        "back" => "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "cubic" => "cubic-bezier(0.65, 0, 0.35, 1)",
        "circ" => "cubic-bezier(0.85, 0, 0.15, 1)",
        "elastic" => ELASTIC_CSS,
        "bounce" => BOUNCE_CSS,
        // "sine", and anything authored by a build we do not know.
        _ => "cubic-bezier(0.37, 0, 0.63, 1)",
    }
}

/// Which edge a `slide` transition enters from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SlideDirection {
    /// Enters from the left, moving right. FreeShow's default.
    #[default]
    LeftRight,
    RightLeft,
    BottomTop,
    TopBottom,
}

impl SlideDirection {
    /// The offset the effect starts from, as CSS `translate(x, y)` components.
    pub fn start_offset(self) -> (&'static str, &'static str) {
        match self {
            SlideDirection::LeftRight => ("-100%", "0%"),
            SlideDirection::RightLeft => ("100%", "0%"),
            SlideDirection::BottomTop => ("0%", "100%"),
            SlideDirection::TopBottom => ("0%", "-100%"),
        }
    }

    fn from_name(name: &str) -> Option<Self> {
        match name {
            "left_right" => Some(SlideDirection::LeftRight),
            "right_left" => Some(SlideDirection::RightLeft),
            "bottom_top" => Some(SlideDirection::BottomTop),
            "top_bottom" => Some(SlideDirection::TopBottom),
            _ => None,
        }
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

impl Transition {
    /// The `slide` direction, read from FreeShow's `custom.direction`.
    ///
    /// Kept in `extra` rather than lifted into a field: that is how FreeShow
    /// stores it, and an unknown direction must round-trip untouched. An
    /// unknown or missing value is FreeShow's default, left to right.
    pub fn direction(&self) -> SlideDirection {
        self.extra
            .get("custom")
            .and_then(|custom| custom.get("direction"))
            .and_then(serde_json::Value::as_str)
            .and_then(SlideDirection::from_name)
            .unwrap_or_default()
    }
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

/// How a media item fills its box.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MediaFit {
    /// Fill the box, cropping the overflow. Right for backgrounds and video.
    #[default]
    Cover,
    /// Fit inside the box, letterboxing. Right for documents and logos.
    Contain,
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
    #[serde(default)]
    pub fit: MediaFit,
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
    fn the_sampled_curves_are_css_linear_lists() {
        for name in ["elastic", "bounce"] {
            let css = easing_css(name);
            assert!(
                css.starts_with("linear("),
                "{name}: {}",
                &css[..20.min(css.len())]
            );
            assert!(css.ends_with(')'));
            assert_eq!(
                css.matches(',').count(),
                100,
                "{name} should carry 101 sampled points"
            );
        }
        assert_eq!(easing_css("elastic"), ELASTIC_CSS);
        assert_eq!(easing_css("bounce"), BOUNCE_CSS);
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
    fn a_slide_direction_is_read_from_custom_and_defaults_left_to_right() {
        let with = |direction: &str| {
            let json = format!(
                r#"{{"type":"slide","duration":500,"easing":"sine","custom":{{"direction":"{direction}"}}}}"#
            );
            serde_json::from_str::<Transition>(&json)
                .unwrap()
                .direction()
        };
        assert_eq!(with("left_right"), SlideDirection::LeftRight);
        assert_eq!(with("right_left"), SlideDirection::RightLeft);
        assert_eq!(with("bottom_top"), SlideDirection::BottomTop);
        assert_eq!(with("top_bottom"), SlideDirection::TopBottom);

        // No custom block, and an unknown value, both mean FreeShow's default.
        let plain: Transition =
            serde_json::from_str(r#"{"type":"slide","duration":500,"easing":"sine"}"#).unwrap();
        assert_eq!(plain.direction(), SlideDirection::LeftRight);
        assert_eq!(with("sideways"), SlideDirection::LeftRight);
    }

    #[test]
    fn an_unknown_direction_round_trips_untouched() {
        let json =
            r#"{"type":"slide","duration":500,"easing":"sine","custom":{"direction":"sideways"}}"#;
        let transition: Transition = serde_json::from_str(json).unwrap();
        assert_eq!(transition.direction(), SlideDirection::LeftRight);
        assert!(serde_json::to_string(&transition)
            .unwrap()
            .contains("sideways"));
    }

    #[test]
    fn the_default_is_freeshows_default_text_transition() {
        let transition = Transition::default();
        assert_eq!(transition.kind, TransitionKind::Fade);
        assert_eq!(transition.duration_ms, 500);
        assert_eq!(transition.easing, "sine");
    }
}
