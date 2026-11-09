//! The project outline: sections and shows, in project order.
//!
//! This is the navigation model behind the drawer's **Shows** tab (P6) and the
//! focus view. The controller no longer renders it as a left column: the left
//! column is the project browser.

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
/// A standalone outline panel for `render --layout outline` evidence.
///
/// The controller renders the same [`OutlineEntry`] list in the drawer's Shows
/// tab (P6); this panel is not mounted by the controller any more.
pub fn OutlinePanel(
    items: Vec<OutlineEntry>,
    current: Option<usize>,
    /// The show the operator has selected; it can differ from the live show
    /// between the two presses of a next-at-the-end move.
    selected: Option<usize>,
    /// Optional so the panel can be rendered headlessly for evidence.
    on_play: Option<EventHandler<usize>>,
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
                            OutlineEntry::Show { name, index } => {
                                let live = current == Some(index);
                                let chosen = !live && selected == Some(index);
                                rsx! {
                                    div {
                                        key: "show-{index}",
                                        class: if live { "outline-show current" } else if chosen { "outline-show selected" } else { "outline-show" },
                                        span { class: "name", "{name}" }
                                        if live {
                                            span { class: "outline-badge", "live" }
                                        } else if chosen {
                                            span { class: "outline-badge selected", "selected" }
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
                                }
                            },
                            OutlineEntry::Other { label } => rsx! {
                                div { key: "other-{position}", class: "outline-other", "{label}" }
                            },
                        }
                    }
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
    /// The show the operator has selected, marked distinctly from the live one
    /// between the two presses of a next-at-the-end move.
    selected: Option<usize>,
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
                            OutlineEntry::Show { name, index } => {
                                let live = current == Some(index);
                                let chosen = !live && selected == Some(index);
                                rsx! {
                                    button {
                                        key: "focus-show-{index}",
                                        class: if live { "focus-show current" } else if chosen { "focus-show selected" } else { "focus-show" },
                                        onclick: move |_| {
                                            if let Some(on_play) = on_play {
                                                on_play.call(index);
                                            }
                                        },
                                        span { class: "focus-name", "{name}" }
                                        if live {
                                            span { class: "focus-badge", "live" }
                                        } else if chosen {
                                            span { class: "focus-badge selected", "selected" }
                                        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use presenter_core::Show;

    fn show(id: &str, name: &str) -> Show {
        Show {
            id: id.into(),
            name: name.into(),
            ..Default::default()
        }
    }

    /// P6: the Shows tab uses this model, so sections are headings and shows
    /// keep the project's entry order — not the order of `project.shows`.
    #[test]
    fn sections_and_shows_keep_the_project_entry_order() {
        let project = Project {
            // Deliberately the reverse of the entry order.
            shows: vec![show("communion", "Communion"), show("worship", "Worship")],
            entries: vec![
                ProjectEntry::Section {
                    id: "opening".into(),
                    name: "Opening".into(),
                },
                ProjectEntry::Show {
                    id: "worship".into(),
                },
                ProjectEntry::Section {
                    id: "sermon".into(),
                    name: "Sermon".into(),
                },
                ProjectEntry::Show {
                    id: "communion".into(),
                },
            ],
            ..Default::default()
        };

        let outline = build(&project);
        assert_eq!(
            outline,
            vec![
                OutlineEntry::Section {
                    name: "Opening".into()
                },
                OutlineEntry::Show {
                    name: "Worship".into(),
                    index: 1,
                },
                OutlineEntry::Section {
                    name: "Sermon".into()
                },
                OutlineEntry::Show {
                    name: "Communion".into(),
                    index: 0,
                },
            ]
        );
    }
}
