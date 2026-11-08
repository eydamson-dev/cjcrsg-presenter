//! The native project format: `.cjcp` (project) and `.cjcs` (single show).
//!
//! A versioned envelope around the domain model. Unknown fields are preserved on
//! round trip, so a file written by a newer build survives a read-write cycle in
//! an older one. See `docs/file-format.md`.

use std::collections::BTreeMap;
use std::path::Path;

use presenter_core::{Project, Show};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const FORMAT_PROJECT: &str = "cjcp";
pub const FORMAT_SHOW: &str = "cjcs";
pub const SUPPORTED_VERSION: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum FormatError {
    #[error("not a JSON document: {0}")]
    Json(#[from] serde_json::Error),

    #[error("unexpected format {found:?}, expected {expected:?}")]
    WrongFormat {
        found: String,
        expected: &'static str,
    },

    #[error("format version {found} is newer than this build supports ({supported})")]
    UnsupportedVersion { found: u32, supported: u32 },

    #[error("{0}")]
    Io(#[from] std::io::Error),
}

/// What a `.cjcp` file holds.
#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub format_version: u32,
    pub app_version: String,
    pub project: Project,
    /// Top-level keys this build does not model, kept verbatim.
    pub extensions: BTreeMap<String, Value>,
}

impl Document {
    pub fn new(project: Project) -> Self {
        Self {
            format_version: SUPPORTED_VERSION,
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            project,
            extensions: BTreeMap::new(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Envelope {
    format: String,
    format_version: u32,
    app_version: String,
    project: Project,
    #[serde(flatten, default)]
    extensions: BTreeMap<String, Value>,
}

pub fn to_json(document: &Document) -> Result<String, FormatError> {
    let envelope = Envelope {
        format: FORMAT_PROJECT.to_string(),
        format_version: document.format_version,
        app_version: document.app_version.clone(),
        project: document.project.clone(),
        extensions: document.extensions.clone(),
    };
    Ok(serde_json::to_string_pretty(&envelope)?)
}

pub fn from_json(json: &str) -> Result<Document, FormatError> {
    // Read the format fields first so a foreign or newer file fails with a
    // useful message instead of a confusing deserialisation error.
    let probe: Value = serde_json::from_str(json)?;
    let format = probe
        .get("format")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    if format != FORMAT_PROJECT {
        return Err(FormatError::WrongFormat {
            found: format,
            expected: FORMAT_PROJECT,
        });
    }

    let version = probe
        .get("format_version")
        .and_then(Value::as_u64)
        .unwrap_or(0) as u32;

    if version > SUPPORTED_VERSION {
        return Err(FormatError::UnsupportedVersion {
            found: version,
            supported: SUPPORTED_VERSION,
        });
    }

    let envelope: Envelope = serde_json::from_str(json)?;
    Ok(Document {
        format_version: envelope.format_version,
        app_version: envelope.app_version,
        project: envelope.project,
        extensions: envelope.extensions,
    })
}

pub fn write(path: &Path, document: &Document) -> Result<(), FormatError> {
    std::fs::write(path, to_json(document)?)?;
    Ok(())
}

pub fn read(path: &Path) -> Result<Document, FormatError> {
    from_json(&std::fs::read_to_string(path)?)
}

/// Read a single show from `.cjcs`.
pub fn read_show(path: &Path) -> Result<Show, FormatError> {
    let json = std::fs::read_to_string(path)?;
    let probe: Value = serde_json::from_str(&json)?;
    let format = probe
        .get("format")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    if format != FORMAT_SHOW {
        return Err(FormatError::WrongFormat {
            found: format,
            expected: FORMAT_SHOW,
        });
    }

    let version = probe
        .get("format_version")
        .and_then(Value::as_u64)
        .unwrap_or(0) as u32;
    if version > SUPPORTED_VERSION {
        return Err(FormatError::UnsupportedVersion {
            found: version,
            supported: SUPPORTED_VERSION,
        });
    }

    #[derive(Deserialize)]
    struct ShowEnvelope {
        show: Show,
    }

    let envelope: ShowEnvelope = serde_json::from_str(&json)?;
    Ok(envelope.show)
}

/// Write a single show as `.cjcs`.
pub fn write_show(path: &Path, show: &Show) -> Result<(), FormatError> {
    let envelope = serde_json::json!({
        "format": FORMAT_SHOW,
        "format_version": SUPPORTED_VERSION,
        "app_version": env!("CARGO_PKG_VERSION"),
        "show": show,
    });
    std::fs::write(path, serde_json::to_string_pretty(&envelope)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use presenter_core::{Slide, SlideElement, SlideGroup};

    fn project() -> Project {
        Project {
            id: "p1".to_string(),
            name: "Sunday".to_string(),
            shows: vec![Show {
                id: "s1".to_string(),
                name: "Worship".to_string(),
                groups: vec![SlideGroup {
                    id: "g1".to_string(),
                    name: "Verse".to_string(),
                    slides: vec![Slide {
                        id: "sl1".to_string(),
                        name: "One".to_string(),
                        elements: vec![SlideElement {
                            id: "e1".to_string(),
                            text: "Hello".to_string(),
                            class_name: "lyrics".to_string(),
                            style: String::new(),
                            ..Default::default()
                        }],
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                ..Default::default()
            }],
            ..Default::default()
        }
    }

    #[test]
    fn round_trips_a_project() {
        let document = Document::new(project());
        let json = to_json(&document).unwrap();
        let back = from_json(&json).unwrap();
        assert_eq!(back.project, document.project);
        assert_eq!(back.format_version, SUPPORTED_VERSION);
    }

    #[test]
    fn preserves_unknown_top_level_keys() {
        let mut document = Document::new(project());
        document.extensions.insert(
            "future_feature".to_string(),
            serde_json::json!({"enabled": true}),
        );

        let json = to_json(&document).unwrap();
        assert!(json.contains("future_feature"));

        let back = from_json(&json).unwrap();
        assert_eq!(
            back.extensions.get("future_feature"),
            Some(&serde_json::json!({"enabled": true}))
        );
    }

    #[test]
    fn preserves_unknown_fields_inside_the_project() {
        let json = r#"{
            "format": "cjcp",
            "format_version": 1,
            "app_version": "9.9.9",
            "project": {
                "id": "p1", "name": "N", "shows": [],
                "something_new": {"deep": [1, 2, 3]}
            }
        }"#;

        let back = from_json(json).unwrap();
        let json_out = to_json(&back).unwrap();
        assert!(json_out.contains("something_new"), "{json_out}");
        assert!(
            json_out.contains("[1,2,3]") || json_out.contains("1,"),
            "{json_out}"
        );
    }

    #[test]
    fn refuses_a_newer_format_version() {
        let json = r#"{"format":"cjcp","format_version":2,"app_version":"1","project":{"id":"p","name":"n","shows":[]}}"#;
        match from_json(json) {
            Err(FormatError::UnsupportedVersion { found, .. }) => assert_eq!(found, 2),
            other => panic!("expected UnsupportedVersion, got {other:?}"),
        }
    }

    #[test]
    fn refuses_a_foreign_document() {
        let json =
            r#"{"format":"something-else","format_version":1,"app_version":"1","project":{}}"#;
        match from_json(json) {
            Err(FormatError::WrongFormat { found, .. }) => assert_eq!(found, "something-else"),
            other => panic!("expected WrongFormat, got {other:?}"),
        }
    }

    #[test]
    fn single_show_round_trips() {
        let directory = std::env::temp_dir().join(format!("cjcs-test-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("show.cjcs");

        let show = project().shows.into_iter().next().unwrap();
        write_show(&path, &show).unwrap();
        let back = read_show(&path).unwrap();
        assert_eq!(back.id, show.id);
        assert_eq!(back.name, show.name);
        assert_eq!(back.slide_count(), 1);

        std::fs::remove_file(&path).ok();
        std::fs::remove_dir(&directory).ok();
    }

    #[test]
    fn a_project_file_is_not_a_show_file() {
        let json = r#"{"format":"cjcp","format_version":1,"app_version":"1","project":{}}"#;
        let path = std::env::temp_dir().join(format!("cjcp-not-cjcs-{}.cjcs", std::process::id()));
        std::fs::write(&path, json).unwrap();
        assert!(matches!(
            read_show(&path),
            Err(FormatError::WrongFormat { .. })
        ));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn json_is_readable_and_diffable() {
        let json = to_json(&Document::new(project())).unwrap();
        assert!(json.contains("\n  \"format\": \"cjcp\""), "pretty printed");
    }
}
