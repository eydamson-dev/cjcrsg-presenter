//! The recent-projects panel.
//!
//! Its own component so the real markup can be rendered headlessly for
//! evidence, the same way slides are, without opening a window.

use dioxus::prelude::*;
use presenter_core::RecentProject;

/// How many entries the controller shows. The session keeps more.
const SHOWN: usize = 5;

#[component]
///
/// The handler is optional so this component can be rendered headlessly with
/// `dioxus-ssr`: creating an `EventHandler` requires a Dioxus runtime, and
/// evidence rendering has none.
pub fn RecentProjects(items: Vec<RecentProject>, on_open: Option<EventHandler<String>>) -> Element {
    rsx! {
        section { class: "panel",
            h2 { "Recent projects" }

            if items.is_empty() {
                p { class: "hint",
                    "Nothing yet. Open a .cjcp from the command line and it appears here."
                }
            } else {
                div { class: "recent-list",
                    for item in items.iter().take(SHOWN).cloned() {
                        div { class: "recent-row", key: "{item.path}",
                            div { class: "recent-name",
                                span { class: "name", "{item.name}" }
                                span { class: "path", "{item.path}" }
                            }
                            button {
                                class: "btn small",
                                onclick: move |_| {
                                    if let Some(on_open) = on_open {
                                        on_open.call(item.path.clone());
                                    }
                                },
                                "Open"
                            }
                        }
                    }
                }
            }
        }
    }
}
