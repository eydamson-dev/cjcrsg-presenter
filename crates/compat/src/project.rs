//! FreeShow project import.
//!
//! A FreeShow project is a metadata record in `projects.json` that references
//! shows by id; the shows themselves live in `shows/*.show`. Importing a
//! project therefore means joining the two, and failing loudly when a referenced
//! show is missing rather than silently producing a short project.

use std::collections::BTreeMap;
use std::path::Path;

use presenter_core::Project;
use serde::Deserialize;

use crate::freeshow::{import_show, ImportError};

#[derive(Debug, thiserror::Error)]
pub enum ProjectImportError {
    #[error("not valid JSON: {0}")]
    Json(#[from] serde_json::Error),

    #[error("no projects in the file")]
    NoProjects,

    #[error("project {0:?} not found")]
    ProjectNotFound(String),

    #[error("project {0:?} references show {1:?}, which is not in the shows folder")]
    MissingShow(String, String),

    #[error("cannot read shows folder {path}: {source}")]
    ShowsFolder {
        path: String,
        #[source]
        source: std::io::Error,
    },

    #[error("show {0:?} could not be imported: {1}")]
    Show(String, #[source] ImportError),
}

#[derive(Debug, Deserialize)]
struct ProjectFile {
    #[serde(default)]
    projects: BTreeMap<String, RawProject>,
}

#[derive(Debug, Deserialize)]
struct RawProject {
    #[serde(default = "unnamed")]
    name: String,
    #[serde(default)]
    shows: Vec<RawRef>,
}

fn unnamed() -> String {
    "Untitled".to_string()
}

#[derive(Debug, Deserialize)]
struct RawRef {
    id: String,
}

/// Import one project by id, or the first project when `project_id` is `None`.
pub fn import_project(
    projects_json: &str,
    shows_dir: &Path,
    project_id: Option<&str>,
) -> Result<Project, ProjectImportError> {
    let file: ProjectFile = serde_json::from_str(projects_json)?;

    if file.projects.is_empty() {
        return Err(ProjectImportError::NoProjects);
    }

    let (id, raw) = match project_id {
        Some(id) => {
            let raw = file
                .projects
                .get(id)
                .ok_or_else(|| ProjectImportError::ProjectNotFound(id.to_string()))?;
            (id.to_string(), raw)
        }
        None => {
            let (id, raw) = file.projects.iter().next().expect("checked non-empty");
            (id.clone(), raw)
        }
    };

    let shows = load_shows(shows_dir)?;
    let mut imported = Vec::with_capacity(raw.shows.len());

    for reference in &raw.shows {
        let show = shows.get(&reference.id).ok_or_else(|| {
            ProjectImportError::MissingShow(raw.name.clone(), reference.id.clone())
        })?;
        imported.push(show.clone());
    }

    Ok(Project {
        id,
        name: raw.name.clone(),
        shows: imported,
        ..Default::default()
    })
}

/// Every `.show` in a folder, indexed by the id inside the file.
fn load_shows(
    shows_dir: &Path,
) -> Result<BTreeMap<String, presenter_core::Show>, ProjectImportError> {
    let entries =
        std::fs::read_dir(shows_dir).map_err(|source| ProjectImportError::ShowsFolder {
            path: shows_dir.display().to_string(),
            source,
        })?;

    let mut shows = BTreeMap::new();
    for entry in entries {
        let entry = entry.map_err(|source| ProjectImportError::ShowsFolder {
            path: shows_dir.display().to_string(),
            source,
        })?;

        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("show") {
            continue;
        }

        let json = match std::fs::read_to_string(&path) {
            Ok(json) => json,
            Err(_) => continue,
        };

        match import_show(&json) {
            Ok(show) => {
                shows.insert(show.id.clone(), show);
            }
            // One unreadable show must not fail the whole project; it will be
            // reported as missing if the project actually references it.
            Err(_) => continue,
        }
    }

    Ok(shows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    const FIXTURE: &str = include_str!("../../../parity/fixtures/parity-three-slides.show");

    fn fixture_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("cjcp-proj-{}-{}", std::process::id(), name));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("Parity Fixture.show"), FIXTURE).unwrap();
        dir
    }

    fn projects_json(show_ids: &[&str]) -> String {
        let shows = show_ids
            .iter()
            .map(|id| format!(r#"{{"id":"{id}"}}"#))
            .collect::<Vec<_>>()
            .join(",");
        format!(r#"{{"projects":{{"proj1":{{"name":"Sunday Morning","shows":[{shows}]}}}}}}"#)
    }

    #[test]
    fn imports_the_first_project_by_default() {
        let dir = fixture_dir("first");
        let project = import_project(&projects_json(&["fx-show"]), &dir, None).unwrap();

        assert_eq!(project.id, "proj1");
        assert_eq!(project.name, "Sunday Morning");
        assert_eq!(project.shows.len(), 1);
        assert_eq!(project.shows[0].name, "Parity Fixture");
        assert_eq!(project.slide_count(), 3);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn imports_a_named_project() {
        let dir = fixture_dir("named");
        let json = r#"{"projects":{
            "a":{"name":"A","shows":[{"id":"fx-show"}]},
            "b":{"name":"B","shows":[{"id":"fx-show"}]}
        }}"#;
        let project = import_project(json, &dir, Some("b")).unwrap();
        assert_eq!(project.name, "B");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_unknown_project_id_is_reported() {
        let dir = fixture_dir("unknown");
        let error = import_project(&projects_json(&["fx-show"]), &dir, Some("nope")).unwrap_err();
        assert!(matches!(error, ProjectImportError::ProjectNotFound(_)));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_referenced_show_that_is_not_on_disk_fails_loudly() {
        let dir = fixture_dir("missing");
        let error = import_project(&projects_json(&["fx-show", "ghost"]), &dir, None).unwrap_err();
        match error {
            ProjectImportError::MissingShow(project, show) => {
                assert_eq!(project, "Sunday Morning");
                assert_eq!(show, "ghost");
            }
            other => panic!("expected MissingShow, got {other}"),
        }

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_empty_projects_file_is_reported() {
        let dir = fixture_dir("empty");
        let error = import_project(r#"{"projects":{}}"#, &dir, None).unwrap_err();
        assert!(matches!(error, ProjectImportError::NoProjects));
        fs::remove_dir_all(&dir).ok();
    }
}
