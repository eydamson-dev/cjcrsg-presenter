//! FreeShow `.show` import.
//!
//! A `.show` file is `[id, show]` JSON. The show carries a flat map of slides
//! and a separate layout that gives them an order — the order matters and is not
//! the map's order. Grouping comes from each slide's `group` field, where `"."`
//! starts a group and `null` continues the previous one.

use std::collections::BTreeMap;

use presenter_core::{Show, Slide, SlideElement, SlideGroup};
use serde::Deserialize;

#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error("not valid JSON: {0}")]
    Json(#[from] serde_json::Error),

    #[error("show has no layout; FreeShow stores slide order in a layout")]
    NoLayout,

    #[error("layout {0:?} has no slides")]
    EmptyLayout(String),
}

/// Import one `.show` document.
pub fn import_show(json: &str) -> Result<Show, ImportError> {
    let (id, raw): (String, RawShow) = serde_json::from_str(json)?;

    let layout_id = raw
        .settings
        .active_layout
        .clone()
        .or_else(|| raw.layouts.keys().next().cloned())
        .ok_or(ImportError::NoLayout)?;

    let layout = raw.layouts.get(&layout_id).ok_or(ImportError::NoLayout)?;
    if layout.slides.is_empty() {
        return Err(ImportError::EmptyLayout(layout_id));
    }

    // Ordered ids: the layout first, then anything the layout forgot, so no
    // slide is silently dropped.
    let mut ordered: Vec<String> = Vec::with_capacity(raw.slides.len());
    for reference in &layout.slides {
        if raw.slides.contains_key(&reference.id) && !ordered.contains(&reference.id) {
            ordered.push(reference.id.clone());
        }
    }
    for slide_id in raw.slides.keys() {
        if !ordered.contains(slide_id) {
            ordered.push(slide_id.clone());
        }
    }

    let mut groups: Vec<SlideGroup> = Vec::new();
    let mut current: Option<usize> = None;

    for (position, slide_id) in ordered.iter().enumerate() {
        let Some(slide) = raw.slides.get(slide_id) else {
            continue;
        };

        // `Some(name)` starts a group, `Some(".")` starts an unnamed one,
        // `None` continues whatever came before.
        let starts_group = match slide.group.as_deref() {
            Some(".") => true,
            Some(_) => true,
            None => current.is_none(),
        };

        if starts_group {
            let name = match slide.group.as_deref() {
                Some(".") | None => format!("Group {}", groups.len() + 1),
                Some(other) => other.to_string(),
            };
            groups.push(SlideGroup {
                id: format!("g-{}", groups.len() + 1),
                name,
                slides: Vec::new(),
                ..Default::default()
            });
            current = Some(groups.len() - 1);
        }

        let group_index = current.expect("a group was just created");
        groups[group_index]
            .slides
            .push(convert_slide(slide, slide_id, position));
    }

    Ok(Show {
        id,
        name: raw.name,
        groups,
        ..Default::default()
    })
}

fn convert_slide(slide: &RawSlide, id: &str, position: usize) -> Slide {
    let elements: Vec<SlideElement> = slide
        .items
        .iter()
        .enumerate()
        .filter_map(|(index, item)| {
            let text = item
                .lines
                .iter()
                .map(|line| {
                    line.text
                        .iter()
                        .map(|t| t.value.as_str())
                        .collect::<Vec<_>>()
                        .join("")
                })
                .collect::<Vec<_>>()
                .join("\n");

            if text.trim().is_empty() {
                return None;
            }

            Some(SlideElement {
                id: format!("{id}-item-{index}"),
                text,
                class_name: "lyrics".to_string(),
                style: item.style.clone(),
                ..Default::default()
            })
        })
        .collect();

    Slide {
        id: id.to_string(),
        name: if slide.notes.trim().is_empty() {
            format!("Slide {}", position + 1)
        } else {
            slide.notes.clone()
        },
        notes: slide.notes.clone(),
        elements,
        ..Default::default()
    }
}

#[derive(Debug, Deserialize)]
struct RawShow {
    #[serde(default = "unnamed")]
    name: String,
    #[serde(default)]
    settings: RawSettings,
    #[serde(default)]
    slides: BTreeMap<String, RawSlide>,
    #[serde(default)]
    layouts: BTreeMap<String, RawLayout>,
}

fn unnamed() -> String {
    "Untitled".to_string()
}

#[derive(Debug, Default, Deserialize)]
struct RawSettings {
    #[serde(rename = "activeLayout", default)]
    active_layout: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct RawSlide {
    #[serde(default)]
    group: Option<String>,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    items: Vec<RawItem>,
}

#[derive(Debug, Default, Deserialize)]
struct RawItem {
    #[serde(default)]
    style: String,
    #[serde(default)]
    lines: Vec<RawLine>,
}

#[derive(Debug, Default, Deserialize)]
struct RawLine {
    #[serde(default)]
    text: Vec<RawText>,
}

#[derive(Debug, Default, Deserialize)]
struct RawText {
    #[serde(default)]
    value: String,
}

#[derive(Debug, Default, Deserialize)]
struct RawLayout {
    #[serde(default)]
    slides: Vec<RawRef>,
}

#[derive(Debug, Deserialize)]
struct RawRef {
    id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../parity/fixtures/parity-three-slides.show");

    #[test]
    fn imports_the_fixture() {
        let show = import_show(FIXTURE).expect("fixture imports");
        assert_eq!(show.id, "fx-show");
        assert_eq!(show.name, "Parity Fixture");
        assert_eq!(show.slide_count(), 3);
    }

    #[test]
    fn follows_layout_order_not_the_slide_map_order() {
        // The fixture's layout is [fx-1, fx-2, fx-3] while a BTreeMap would put
        // them in key order — prove the layout wins by reversing it.
        let value: serde_json::Value = serde_json::from_str(FIXTURE).unwrap();
        let mut show = value[1].clone();
        show["layouts"]["lay-parity"]["slides"] =
            serde_json::json!([{"id": "fx-3"}, {"id": "fx-1"}, {"id": "fx-2"}]);
        let json = serde_json::to_string(&serde_json::json!(["fx-show", show])).unwrap();

        let imported = import_show(&json).unwrap();
        let ids: Vec<&str> = imported
            .slides()
            .map(|(_, slide)| slide.id.as_str())
            .collect();
        assert_eq!(ids, ["fx-3", "fx-1", "fx-2"]);
    }

    #[test]
    fn keeps_multiline_text() {
        let show = import_show(FIXTURE).unwrap();
        let first = show.slides().next().unwrap().1;
        assert_eq!(first.elements.len(), 1);
        assert_eq!(
            first.elements[0].text,
            "Verse one, line one\nVerse one, line two"
        );
    }

    #[test]
    fn dot_starts_a_group_and_null_continues_it() {
        let show = import_show(FIXTURE).unwrap();
        // fx-1 has group ".", fx-2 and fx-3 have null → one group of three.
        assert_eq!(show.groups.len(), 1);
        assert_eq!(show.groups[0].slides.len(), 3);
    }

    #[test]
    fn a_show_without_a_layout_is_rejected() {
        let json = r#"["x", {"name": "No layout", "slides": {}, "layouts": {}}]"#;
        assert!(matches!(import_show(json), Err(ImportError::NoLayout)));
    }

    #[test]
    fn broken_json_is_reported_not_panicked() {
        assert!(matches!(
            import_show("{not json"),
            Err(ImportError::Json(_))
        ));
    }
}
