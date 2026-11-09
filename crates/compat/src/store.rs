//! Importing a whole FreeShow data folder.
//!
//! FreeShow keeps `projects.json` and a `shows/` folder in its user-data
//! directory. `import_project` handles one project; this walks the file and
//! writes one `.cjcp` per project, reporting the ones that could not be
//! imported instead of stopping at the first broken reference.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::cjcp::{self, Document};
use crate::project::{import_project, project_list, ProjectImportError};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("no projects.json in {0}")]
    NoProjectsFile(String),

    #[error("cannot read {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },

    #[error("projects.json is not valid: {0}")]
    Projects(#[from] ProjectImportError),
}

#[derive(Debug, Default)]
pub struct StoreReport {
    /// Project name and the file written.
    pub imported: Vec<(String, PathBuf)>,
    /// Project name and why it was skipped.
    pub failed: Vec<(String, String)>,
}

pub fn import_store(store: &Path, out_dir: &Path) -> Result<StoreReport, StoreError> {
    let projects_path = store.join("projects.json");
    let projects_json = std::fs::read_to_string(&projects_path).map_err(|source| {
        if source.kind() == std::io::ErrorKind::NotFound {
            StoreError::NoProjectsFile(store.display().to_string())
        } else {
            StoreError::Io {
                path: projects_path.display().to_string(),
                source,
            }
        }
    })?;

    let projects = project_list(&projects_json)?;
    let shows_dir = store.join("shows");
    let categories = read_categories(store);

    std::fs::create_dir_all(out_dir).map_err(|source| StoreError::Io {
        path: out_dir.display().to_string(),
        source,
    })?;

    let mut report = StoreReport::default();
    let mut used_names: Vec<String> = Vec::new();

    for project in projects {
        match import_project(&projects_json, &shows_dir, Some(&project.id)) {
            Ok(mut imported) => {
                imported.categories = categories.clone();
                let mut file_name = sanitise(&project.name);
                if used_names.contains(&file_name) {
                    file_name = format!("{file_name}-{}", sanitise(&project.id));
                }
                used_names.push(file_name.clone());

                let destination = out_dir.join(format!("{file_name}.cjcp"));
                match cjcp::write(&destination, &Document::new(imported)) {
                    Ok(()) => report.imported.push((project.name, destination)),
                    Err(error) => report.failed.push((project.name, error.to_string())),
                }
            }
            Err(error) => report.failed.push((project.name, error.to_string())),
        }
    }

    Ok(report)
}

/// FreeShow keeps category names in `settings_synced.json`. A missing or
/// malformed file just means no names; it must not fail a migration.
fn read_categories(store: &Path) -> BTreeMap<String, String> {
    #[derive(Deserialize)]
    struct Synced {
        #[serde(default)]
        categories: BTreeMap<String, Category>,
    }
    #[derive(Deserialize)]
    struct Category {
        #[serde(default)]
        name: String,
    }

    let Ok(json) = std::fs::read_to_string(store.join("settings_synced.json")) else {
        return BTreeMap::new();
    };
    let Ok(synced) = serde_json::from_str::<Synced>(&json) else {
        return BTreeMap::new();
    };

    synced
        .categories
        .into_iter()
        .filter(|(_, category)| !category.name.is_empty())
        .map(|(id, category)| (id, category.name))
        .collect()
}

fn sanitise(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim().to_string();
    if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cjcp-store-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("store/shows")).unwrap();
        std::fs::create_dir_all(dir.join("out")).unwrap();
        dir
    }

    const SHOW: &str = include_str!("../../../parity/fixtures/parity-three-slides.show");

    #[test]
    fn every_project_becomes_its_own_cjcp() {
        let root = scratch("all");
        let store = root.join("store");
        std::fs::write(store.join("shows/Parity Fixture.show"), SHOW).unwrap();
        std::fs::write(
            store.join("projects.json"),
            r#"{"projects":{
                "a":{"name":"Sunday Morning","shows":[{"id":"fx-show"}]},
                "b":{"name":"Wednesday","shows":[{"id":"fx-show"}]}
            }}"#,
        )
        .unwrap();

        let report = import_store(&store, &root.join("out")).unwrap();
        assert_eq!(report.imported.len(), 2);
        assert!(report.failed.is_empty());
        assert!(root.join("out/Sunday Morning.cjcp").exists());
        assert!(root.join("out/Wednesday.cjcp").exists());

        let document = cjcp::read(&root.join("out/Sunday Morning.cjcp")).unwrap();
        assert_eq!(document.project.name, "Sunday Morning");
        assert_eq!(document.project.slide_count(), 3);

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn category_names_come_from_the_synced_settings() {
        let root = scratch("categories");
        let store = root.join("store");
        std::fs::write(store.join("shows/Parity Fixture.show"), SHOW).unwrap();
        std::fs::write(
            store.join("projects.json"),
            r#"{"projects":{"a":{"name":"Sunday","shows":[{"id":"fx-show"}]}}}"#,
        )
        .unwrap();
        std::fs::write(
            store.join("settings_synced.json"),
            r#"{"categories":{"song":{"name":"Songs"},"talk":{"name":"Talks"}}}"#,
        )
        .unwrap();

        let report = import_store(&store, &root.join("out")).unwrap();
        assert_eq!(report.imported.len(), 1);

        let document = cjcp::read(&root.join("out/Sunday.cjcp")).unwrap();
        assert_eq!(
            document.project.categories.get("song").map(String::as_str),
            Some("Songs")
        );
        assert_eq!(
            document.project.categories.get("talk").map(String::as_str),
            Some("Talks")
        );

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_malformed_synced_settings_file_does_not_fail_the_migration() {
        let root = scratch("badcats");
        let store = root.join("store");
        std::fs::write(store.join("shows/Parity Fixture.show"), SHOW).unwrap();
        std::fs::write(
            store.join("projects.json"),
            r#"{"projects":{"a":{"name":"Sunday","shows":[{"id":"fx-show"}]}}}"#,
        )
        .unwrap();
        std::fs::write(store.join("settings_synced.json"), "{not json").unwrap();

        let report = import_store(&store, &root.join("out")).unwrap();
        assert_eq!(report.imported.len(), 1);
        let document = cjcp::read(&root.join("out/Sunday.cjcp")).unwrap();
        assert!(document.project.categories.is_empty());

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_project_with_a_missing_show_is_reported_and_the_rest_still_import() {
        let root = scratch("partial");
        let store = root.join("store");
        std::fs::write(store.join("shows/Parity Fixture.show"), SHOW).unwrap();
        std::fs::write(
            store.join("projects.json"),
            r#"{"projects":{
                "good":{"name":"Good","shows":[{"id":"fx-show"}]},
                "broken":{"name":"Broken","shows":[{"id":"missing-show"}]}
            }}"#,
        )
        .unwrap();

        let report = import_store(&store, &root.join("out")).unwrap();
        assert_eq!(report.imported.len(), 1);
        assert_eq!(report.imported[0].0, "Good");
        assert_eq!(report.failed.len(), 1);
        assert_eq!(report.failed[0].0, "Broken");

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_folder_without_projects_json_says_so() {
        let root = scratch("empty");
        match import_store(&root.join("store"), &root.join("out")) {
            Err(StoreError::NoProjectsFile(_)) => {}
            other => panic!("expected NoProjectsFile, got {other:?}"),
        }
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn duplicate_project_names_get_distinct_files() {
        assert_eq!(
            sanitise("Sunday: Morning/Evening"),
            "Sunday_ Morning_Evening"
        );
        assert_eq!(sanitise("   "), "project");
    }
}
