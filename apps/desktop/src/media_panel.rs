//! The project's media, as the controller shows it.
//!
//! Read-only on purpose: this is the operator's view of what the project
//! references, whether the files are there, and what came in with tags. Adding
//! and removing media is a different feature.

use std::path::Path;

use dioxus::prelude::*;
use presenter_core::{MediaAsset, MediaKind, MediaOrigin, Project};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MediaItem {
    pub id: String,
    /// File name only; the full path is long and rarely useful on a controller.
    pub name: String,
    pub kind: &'static str,
    pub origin: &'static str,
    pub tags: Vec<String>,
    pub size: Option<u64>,
    pub missing: bool,
}

impl MediaItem {
    /// Audio is its own drawer tab, so the split has to be one predicate used
    /// from both sides; `kind` is the display string, so compare that.
    pub fn is_audio(&self) -> bool {
        self.kind == "audio"
    }
}

/// Split media into the Media tab (everything else) and the Audio tab, keeping
/// project order inside each list.
pub fn split(items: Vec<MediaItem>) -> (Vec<MediaItem>, Vec<MediaItem>) {
    let mut visual = Vec::new();
    let mut audio = Vec::new();
    for item in items {
        if item.is_audio() {
            audio.push(item);
        } else {
            visual.push(item);
        }
    }
    (visual, audio)
}

pub fn build(project: &Project, root: Option<&Path>) -> Vec<MediaItem> {
    project
        .media
        .iter()
        .map(|asset| item(asset, root))
        .collect()
}

fn item(asset: &MediaAsset, root: Option<&Path>) -> MediaItem {
    let path = Path::new(&asset.path);
    let resolved = if path.is_absolute() {
        path.to_path_buf()
    } else {
        match root {
            Some(root) => root.join(path),
            None => path.to_path_buf(),
        }
    };

    MediaItem {
        id: asset.id.clone(),
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| asset.path.clone()),
        kind: match asset.kind {
            MediaKind::Image => "image",
            MediaKind::Video => "video",
            MediaKind::Audio => "audio",
            MediaKind::Other => "file",
        },
        origin: match asset.origin {
            MediaOrigin::Bundled => "bundled",
            MediaOrigin::External => "external",
        },
        tags: asset.tags.clone(),
        size: asset
            .size
            .or_else(|| std::fs::metadata(&resolved).ok().map(|m| m.len())),
        missing: !resolved.is_file(),
    }
}

fn human_size(bytes: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{bytes} B")
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

#[component]
pub fn MediaPanel(items: Vec<MediaItem>) -> Element {
    rsx! {
        section { class: "panel",
            h2 { "Media" }

            if items.is_empty() {
                p { class: "hint", "This project references no media." }
            } else {
                MediaList { items }
            }
        }
    }
}

/// The rows alone, so the drawer can render them under its own tab heading.
#[component]
pub fn MediaList(items: Vec<MediaItem>) -> Element {
    rsx! {
        div { class: "media-list",
            for item in items.iter().cloned() {
                div { key: "{item.id}", class: if item.missing { "media-row missing" } else { "media-row" },
                    div { class: "media-name",
                        span { class: "name", "{item.name}" }
                        span { class: "media-meta",
                            "{item.kind} · {item.origin}"
                            if let Some(size) = item.size {
                                " · {human_size(size)}"
                            }
                            if item.missing {
                                " · missing"
                            }
                        }
                        if !item.tags.is_empty() {
                            span { class: "media-tags", "{item.tags.join(\", \")}" }
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
    use presenter_core::{MediaAsset, MediaKind};

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("cjcp-media-ui-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn bundled_media_resolves_against_the_project_and_reports_missing_files() {
        let root = scratch("bundled");
        std::fs::write(root.join("clip.webm"), b"12345").unwrap();

        let project = Project {
            media: vec![
                MediaAsset::new("m1", MediaKind::Video, "clip.webm"),
                MediaAsset::new("m2", MediaKind::Image, "gone.png"),
            ],
            ..Default::default()
        };

        let items = build(&project, Some(&root));
        assert_eq!(items[0].name, "clip.webm");
        assert_eq!(items[0].kind, "video");
        assert_eq!(items[0].origin, "bundled");
        assert_eq!(items[0].size, Some(5));
        assert!(!items[0].missing);

        assert!(items[1].missing, "a file that is not there is flagged");
        assert_eq!(items[1].size, None);

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn external_media_uses_its_absolute_path_and_keeps_tags() {
        let mut asset = MediaAsset::external("m1", MediaKind::Audio, "/srv/media/track.mp3");
        asset.tags = vec!["worship".into(), "service".into()];
        let project = Project {
            media: vec![asset],
            ..Default::default()
        };

        let items = build(&project, Some(Path::new("/ignored")));
        assert_eq!(items[0].name, "track.mp3");
        assert_eq!(items[0].origin, "external");
        assert_eq!(items[0].tags, ["worship", "service"]);
    }

    #[test]
    fn sizes_are_human_readable() {
        assert_eq!(human_size(512), "512 B");
        assert_eq!(human_size(1536), "1.5 KB");
        assert_eq!(human_size(9 * 1024 * 1024), "9.0 MB");
    }

    #[test]
    fn media_splits_into_the_media_and_audio_tabs_in_project_order() {
        let project = Project {
            media: vec![
                MediaAsset::new("m1", MediaKind::Image, "sunrise.jpg"),
                MediaAsset::new("m2", MediaKind::Audio, "track-one.mp3"),
                MediaAsset::new("m3", MediaKind::Video, "loop.mp4"),
                MediaAsset::new("m4", MediaKind::Audio, "track-two.wav"),
            ],
            ..Default::default()
        };

        let (visual, audio) = split(build(&project, None));
        assert_eq!(
            visual
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            ["m1", "m3"]
        );
        assert_eq!(
            audio
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            ["m2", "m4"]
        );
        assert!(audio.iter().all(MediaItem::is_audio));
        assert!(visual.iter().all(|item| !item.is_audio()));
    }
}
