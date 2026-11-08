//! Media references.
//!
//! A project never identifies a file by an absolute path. `origin` says whether
//! the file belongs to the project (`Bundled`, relative, portable) or lives
//! elsewhere (`External`, may be absolute, explicitly not portable).
//!
//! See `docs/file-format.md#media-references`.

use std::path::{Component, Path};

use serde::{Deserialize, Serialize};

use crate::domain::Id;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MediaOrigin {
    /// Inside the project folder. The path is relative to the project root.
    #[default]
    Bundled,
    /// Anywhere else. The path may be absolute and is not portable.
    External,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Image,
    Video,
    Audio,
    #[default]
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaAsset {
    pub id: Id,
    #[serde(default)]
    pub kind: MediaKind,
    #[serde(default)]
    pub origin: MediaOrigin,
    /// Forward slashes, always. Relative to the project root when `Bundled`.
    pub path: String,
    /// Bytes. Used to detect a file that changed underneath the project.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// `blake3:<hex>`. Optional until zip packaging lands.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
    /// Last known location, offered as a relink suggestion. Never resolved
    /// silently: two files called `bg.mp4` would be indistinguishable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub relink_hint: Option<String>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MediaError {
    #[error("a bundled asset must use a relative path, found {0:?}")]
    AbsoluteBundledPath(String),
    #[error("a bundled asset must not escape the project root: {0:?}")]
    EscapesProjectRoot(String),
    #[error("paths must use forward slashes: {0:?}")]
    Backslashes(String),
}

impl MediaAsset {
    pub fn new(id: impl Into<Id>, kind: MediaKind, path: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            kind,
            origin: MediaOrigin::Bundled,
            path: path.into(),
            size: None,
            hash: None,
            relink_hint: None,
        }
    }

    pub fn external(id: impl Into<Id>, kind: MediaKind, path: impl Into<String>) -> Self {
        Self {
            origin: MediaOrigin::External,
            ..Self::new(id, kind, path)
        }
    }

    /// Check the rules that make a project portable.
    ///
    /// Validation is a separate step from parsing: an unreadable path should not
    /// stop a project from opening, but it should be reported.
    pub fn validate(&self) -> Result<(), MediaError> {
        if self.path.contains('\\') {
            return Err(MediaError::Backslashes(self.path.clone()));
        }

        let path = Path::new(&self.path);

        if self.origin == MediaOrigin::Bundled {
            if path.is_absolute() {
                return Err(MediaError::AbsoluteBundledPath(self.path.clone()));
            }

            // A bundled path must stay inside the project. `..` at the start is
            // how a path escapes.
            let mut depth: i32 = 0;
            for component in path.components() {
                match component {
                    Component::ParentDir => {
                        depth -= 1;
                        if depth < 0 {
                            return Err(MediaError::EscapesProjectRoot(self.path.clone()));
                        }
                    }
                    Component::Normal(_) => depth += 1,
                    _ => {}
                }
            }
        }

        Ok(())
    }

    /// Where the file should be looked up, given the project root.
    pub fn resolve(&self, project_root: &Path) -> std::path::PathBuf {
        project_root.join(&self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bundled_path_is_relative_and_resolves_inside_the_project() {
        let asset = MediaAsset::new("m1", MediaKind::Video, "media/worship.mp4");
        assert!(asset.validate().is_ok());
        assert_eq!(
            asset.resolve(Path::new("/projects/sunday")),
            Path::new("/projects/sunday/media/worship.mp4")
        );
    }

    #[test]
    fn a_bundled_absolute_path_is_rejected() {
        let asset = MediaAsset::new("m1", MediaKind::Video, "/home/user/worship.mp4");
        assert_eq!(
            asset.validate(),
            Err(MediaError::AbsoluteBundledPath(
                "/home/user/worship.mp4".into()
            ))
        );
    }

    #[test]
    fn a_bundled_path_may_not_escape_the_project_root() {
        let asset = MediaAsset::new("m1", MediaKind::Video, "../shared/worship.mp4");
        assert_eq!(
            asset.validate(),
            Err(MediaError::EscapesProjectRoot(
                "../shared/worship.mp4".into()
            ))
        );
    }

    #[test]
    fn an_internal_parent_dir_is_allowed() {
        let asset = MediaAsset::new("m1", MediaKind::Video, "media/sets/../worship.mp4");
        assert!(asset.validate().is_ok());
    }

    #[test]
    fn an_external_absolute_path_is_allowed_and_marked_not_portable() {
        let asset = MediaAsset::external("m1", MediaKind::Video, "/srv/media/worship.mp4");
        assert!(asset.validate().is_ok());
        assert_eq!(asset.origin, MediaOrigin::External);
    }

    #[test]
    fn backslashes_are_rejected_everywhere() {
        let asset = MediaAsset::new("m1", MediaKind::Video, "media\\worship.mp4");
        assert!(matches!(asset.validate(), Err(MediaError::Backslashes(_))));
    }

    #[test]
    fn round_trips_through_json_without_optional_noise() {
        let asset = MediaAsset::new("m1", MediaKind::Video, "media/worship.mp4");
        let json = serde_json::to_string(&asset).unwrap();
        assert!(!json.contains("size"), "{json}");
        assert!(json.contains("\"origin\":\"bundled\""), "{json}");

        let back: MediaAsset = serde_json::from_str(&json).unwrap();
        assert_eq!(back, asset);
    }
}
