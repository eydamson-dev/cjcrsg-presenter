//! What a project *means*.
//!
//! These types are persisted and must stay compatible with FreeShow's formats.
//! They are not what an output window renders — that is [`crate::render`].

use serde::{Deserialize, Serialize};

pub type Id = String;

/// A loaded project: the unit a user opens and saves.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Project {
    pub id: Id,
    pub name: String,
    pub shows: Vec<Show>,
}

/// One presentable show.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Show {
    pub id: Id,
    pub name: String,
    pub groups: Vec<SlideGroup>,
}

/// A run of slides that belong together (a song verse set, a scripture set).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SlideGroup {
    pub id: Id,
    pub name: String,
    pub slides: Vec<Slide>,
}

/// One screenful of content.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Slide {
    pub id: Id,
    pub name: String,
    pub elements: Vec<SlideElement>,
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
