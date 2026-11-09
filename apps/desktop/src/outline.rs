//! The project outline: sections and shows, in project order.
//!
//! This is the navigation half of FreeShow's focus mode. It is a panel rather
//! than a full-screen view: the service can be started item by item, but the
//! controller keeps its other tools visible.

use dioxus::prelude::*;
use presenter_core::{Project, ProjectEntry};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutlineEntry {
    Section { name: String },
    Show { name: String, index: usize },
    Other { label: String },
}

/// Build the outline from the project's ordered entries.
///
/// A project built from a single show has no entries; its shows are the outline.
pub fn build(project: &Project) -> Vec<OutlineEntry> {
    if project.entries.is_empty() {
        return project
            .shows
            .iter()
            .enumerate()
            .map(|(index, show)| OutlineEntry::Show {
                name: show.name.clone(),
                index,
            })
            .collect();
    }

    let mut outline = Vec::with_capacity(project.entries.len());
    for entry in &project.entries {
        match entry {
            ProjectEntry::Section { name, .. } => {
                outline.push(OutlineEntry::Section { name: name.clone() })
            }
            ProjectEntry::Show { id } => {
                if let Some(index) = project.shows.iter().position(|show| &show.id == id) {
                    outline.push(OutlineEntry::Show {
                        name: project.shows[index].name.clone(),
                        index,
                    });
                }
            }
            ProjectEntry::Other { item_type, .. } => outline.push(OutlineEntry::Other {
                label: item_type.clone(),
            }),
        }
    }
    outline
}

#[component]
pub fn OutlinePanel(
    items: Vec<OutlineEntry>,
    current: Option<usize>,
    /// Optional so the panel can be rendered headlessly for evidence.
    on_play: Option<EventHandler<usize>>,
    /// The file the project lives in, if it has one.
    project_path: Option<String>,
    on_bundle: Option<EventHandler<()>>,
    bundle_status: String,
) -> Element {
    rsx! {
        section { class: "panel",
            h2 { "Project" }

            if items.is_empty() {
                p { class: "hint", "No project loaded." }
            } else {
                div { class: "outline",
                    for (position, item) in items.iter().cloned().enumerate() {
                        match item {
                            OutlineEntry::Section { name } => rsx! {
                                div { key: "section-{position}", class: "outline-section", "{name}" }
                            },
                            OutlineEntry::Show { name, index } => rsx! {
                                div {
                                    key: "show-{index}",
                                    class: if current == Some(index) { "outline-show current" } else { "outline-show" },
                                    span { class: "name", "{name}" }
                                    if current == Some(index) {
                                        span { class: "outline-badge", "live" }
                                    }
                                    button {
                                        class: "btn small",
                                        onclick: move |_| {
                                            if let Some(on_play) = on_play {
                                                on_play.call(index);
                                            }
                                        },
                                        "Play"
                                    }
                                }
                            },
                            OutlineEntry::Other { label } => rsx! {
                                div { key: "other-{position}", class: "outline-other", "{label}" }
                            },
                        }
                    }
                }
            }

            div { class: "outline-foot",
                if let Some(path) = project_path {
                    span { class: "outline-path", "{path}" }
                    button {
                        class: "btn small",
                        onclick: move |_| {
                            if let Some(on_bundle) = on_bundle {
                                on_bundle.call(());
                            }
                        },
                        "Make portable"
                    }
                } else {
                    span { class: "outline-path", "Not saved to a file yet." }
                }
                if !bundle_status.is_empty() {
                    span { class: "outline-status", "{bundle_status}" }
                }
            }
        }
    }
}

/// Full-screen focus view: the project as a large, clickable list.
///
/// FreeShow's focus mode replaces the controller UI rather than opening another
/// window, so this does the same. It is the same data as [`OutlinePanel`], at a
/// size an operator can hit from across the room.
#[component]
pub fn FocusView(
    items: Vec<OutlineEntry>,
    current: Option<usize>,
    on_play: Option<EventHandler<usize>>,
    on_exit: Option<EventHandler<()>>,
    slide: String,
    position: usize,
    total: usize,
) -> Element {
    rsx! {
        div { class: "focus-view",
            div { class: "focus-head",
                div {
                    h1 { "Focus" }
                    p { class: "focus-live", "{slide} · {position} / {total}" }
                }
                button {
                    class: "btn",
                    onclick: move |_| {
                        if let Some(on_exit) = on_exit {
                            on_exit.call(());
                        }
                    },
                    "Exit focus"
                }
            }

            div { class: "focus-list",
                if items.is_empty() {
                    p { class: "hint", "No project loaded." }
                } else {
                    for (position, item) in items.iter().cloned().enumerate() {
                        match item {
                            OutlineEntry::Section { name } => rsx! {
                                div { key: "focus-section-{position}", class: "focus-section", "{name}" }
                            },
                            OutlineEntry::Show { name, index } => rsx! {
                                button {
                                    key: "focus-show-{index}",
                                    class: if current == Some(index) { "focus-show current" } else { "focus-show" },
                                    onclick: move |_| {
                                        if let Some(on_play) = on_play {
                                            on_play.call(index);
                                        }
                                    },
                                    span { class: "focus-name", "{name}" }
                                    if current == Some(index) {
                                        span { class: "focus-badge", "live" }
                                    }
                                }
                            },
                            OutlineEntry::Other { label } => rsx! {
                                div { key: "focus-other-{position}", class: "focus-other", "{label}" }
                            },
                        }
                    }
                }
            }
        }
    }
}
