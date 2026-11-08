//! What a project *means*.
//!
//! These types are persisted and must stay compatible with FreeShow's formats.
//! They are not what an output window renders — that is [`crate::render`].

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type Id = String;

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
    /// Fields we do not model yet, preserved verbatim on save.
    #[serde(flatten, default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extra: BTreeMap<String, Value>,
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
}
