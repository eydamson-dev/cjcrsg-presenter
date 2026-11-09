//! The controller's left project browser.
//!
//! FreeShow's left column is a project tree; this build has no project
//! catalogue, only the open file-backed project and the session's flat recent
//! list. The browser is an honest view of those two: the open project first,
//! then the recents, with a render-time file check and a reversible Forget.
//!
//! The model is split from the component so the ordering, dedupe and
//! missing-file rules can be tested with `cargo test` and no window.

use std::path::Path;

use dioxus::prelude::*;
use presenter_core::{RecentProject, Session};

/// Shown when the session has no recent projects at all (P5). The text is the
/// contract's exact sentence; the scenario asserts it verbatim.
pub const NO_RECENTS: &str =
    "No recent projects. Open a .cjcp from the command line and it appears here.";

/// One row of the browser. `current` marks the open project's own file; the
/// demo project has no file and is never a row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectRow {
    pub name: String,
    pub path: String,
    pub current: bool,
    pub missing: bool,
}

/// Whether a project file cannot be used right now.
///
/// Called while the panel renders, not once at startup: a file restored while
/// the controller runs becomes openable again without a restart (P2). A
/// directory and a file whose permissions deny reading both count as missing.
pub fn is_missing(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return true;
    };
    if !metadata.is_file() {
        return true;
    }
    std::fs::File::open(path).is_err()
}

/// Whether two project paths name the same file.
///
/// Session entries are usually absolute, but a project opened from the command
/// line is recorded exactly as typed; comparing absolute forms keeps a relative
/// entry from duplicating the open project's row.
pub fn same_project(left: &Path, right: &Path) -> bool {
    match (std::path::absolute(left), std::path::absolute(right)) {
        (Ok(left), Ok(right)) => left == right,
        _ => left == right,
    }
}

/// Build the displayed rows: the open file-backed project, then every other
/// recent project in session order (newest first), deduplicated by path.
///
/// The browser shows the whole session list: the session already caps it at
/// `MAX_RECENT`, and the open project is never dropped just because it is not
/// in the list.
pub fn build(open: Option<(&Path, &str)>, recent: &[RecentProject]) -> Vec<ProjectRow> {
    let mut rows: Vec<ProjectRow> = Vec::with_capacity(recent.len() + 1);

    if let Some((path, name)) = open {
        rows.push(ProjectRow {
            name: name.to_string(),
            path: path.display().to_string(),
            current: true,
            missing: is_missing(path),
        });
    }

    for entry in recent {
        let entry_path = Path::new(&entry.path);
        let is_open = open.is_some_and(|(path, _)| same_project(path, entry_path));
        let already_shown = rows
            .iter()
            .any(|row| same_project(Path::new(&row.path), entry_path));
        if is_open || already_shown {
            continue;
        }
        rows.push(ProjectRow {
            name: entry.name.clone(),
            path: entry.path.clone(),
            current: false,
            missing: is_missing(entry_path),
        });
    }

    rows
}

/// Remove `path` from the session's recent list unless it is the open project.
///
/// Returns whether an entry was actually removed. The file on disk is never
/// touched (P4). Split from [`crate::runtime::AppState::forget_recent`] so the
/// rule is testable without a window, an engine or a session file.
pub fn forget_recent(session: &mut Session, open: Option<&Path>, path: &str) -> bool {
    if let Some(open) = open {
        if same_project(open, Path::new(path)) {
            return false;
        }
    }
    let before = session.recent.len();
    session.forget(path);
    session.recent.len() != before
}

#[component]
/// The Projects panel, as the controller's left column renders it.
///
/// Handlers are optional so the panel can be rendered headlessly for evidence
/// with `dioxus-ssr`: creating an `EventHandler` needs a Dioxus runtime.
pub fn ProjectsPanel(
    rows: Vec<ProjectRow>,
    /// Optional so the panel can be rendered headlessly for evidence.
    on_open: Option<EventHandler<String>>,
    on_forget: Option<EventHandler<String>>,
    /// The file the open project lives in, if it has one.
    project_path: Option<String>,
    on_bundle: Option<EventHandler<()>>,
    bundle_status: String,
    /// The inline open error, under the list and never inside a row (P3).
    error: Option<String>,
) -> Element {
    rsx! {
        section { class: "panel projects-panel",
            h2 { "Projects" }

            if rows.is_empty() {
                p { class: "hint", "{NO_RECENTS}" }
            } else {
                div { class: "project-list",
                    for row in rows.iter().cloned() {
                        div {
                            key: "{row.path}",
                            class: if row.current { "project-row current" } else if row.missing { "project-row missing" } else { "project-row" },
                            button {
                                class: "project-open",
                                disabled: row.missing,
                                onclick: {
                                    // One copy per handler: the closure is
                                    // `move`, and `row` is still used below.
                                    let path = row.path.clone();
                                    move |_| {
                                        // P3: the open row's own click does nothing.
                                        if row.current {
                                            return;
                                        }
                                        if let Some(on_open) = on_open {
                                            on_open.call(path.clone());
                                        }
                                    }
                                },
                                span { class: "name", "{row.name}" }
                                span { class: "path", "{row.path}" }
                            }
                            if row.current {
                                span { class: "current-badge", "current" }
                            }
                            if row.missing {
                                span { class: "project-missing", "missing" }
                            }
                            if !row.current {
                                button {
                                    class: "btn small project-forget",
                                    onclick: {
                                        let path = row.path.clone();
                                        move |_| {
                                            if let Some(on_forget) = on_forget {
                                                on_forget.call(path.clone());
                                            }
                                        }
                                    },
                                    "Forget"
                                }
                            }
                        }
                    }
                }
            }

            if let Some(message) = error {
                p { class: "hint error project-error", "{message}" }
            }

            div { class: "outline-foot projects-foot",
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "cjcp-project-browser-{}-{name}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("scratch directory");
        dir
    }

    fn project_file(dir: &Path, name: &str) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, b"{}").expect("project file");
        path
    }

    fn recent(name: &str, path: &Path) -> RecentProject {
        RecentProject {
            name: name.to_string(),
            path: path.display().to_string(),
            opened_at: 0,
        }
    }

    fn names(rows: &[ProjectRow]) -> Vec<&str> {
        rows.iter().map(|row| row.name.as_str()).collect()
    }

    #[test]
    fn the_open_project_is_first_and_appears_exactly_once() {
        let dir = scratch("open-once");
        let main = project_file(&dir, "main.cjcp");
        let second = project_file(&dir, "second.cjcp");
        let third = project_file(&dir, "third.cjcp");

        // The open project's own entry sits in the middle of the recents:
        // "open first" must win, and the duplicate must be dropped.
        let recents = vec![
            recent("Second", &second),
            recent("Main", &main),
            recent("Third", &third),
        ];
        let rows = build(Some((main.as_path(), "Main")), &recents);

        assert_eq!(names(&rows), ["Main", "Second", "Third"]);
        assert_eq!(
            rows.iter().map(|row| row.current).collect::<Vec<_>>(),
            [true, false, false]
        );
        assert!(
            rows.iter().all(|row| !row.missing),
            "every file exists in this fixture"
        );

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn recent_rows_keep_the_session_order_newest_first() {
        let dir = scratch("order");
        let a = project_file(&dir, "a.cjcp");
        let b = project_file(&dir, "b.cjcp");
        let c = project_file(&dir, "c.cjcp");

        let recents = vec![recent("C", &c), recent("A", &a), recent("B", &b)];
        let rows = build(None, &recents);

        assert_eq!(names(&rows), ["C", "A", "B"]);
        assert!(rows.iter().all(|row| !row.current));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_open_project_alone_is_the_only_row() {
        let dir = scratch("open-only");
        let main = project_file(&dir, "main.cjcp");
        let recents = vec![recent("Main", &main)];

        let rows = build(Some((main.as_path(), "Main")), &recents);

        assert_eq!(rows.len(), 1, "P5: the open project, not the empty state");
        assert!(rows[0].current);
        assert!(!rows[0].missing);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn repeated_recent_paths_are_deduplicated() {
        let dir = scratch("dedupe");
        let a = project_file(&dir, "a.cjcp");
        let b = project_file(&dir, "b.cjcp");

        let recents = vec![recent("A", &a), recent("B", &b), recent("A again", &a)];
        let rows = build(None, &recents);

        assert_eq!(names(&rows), ["A", "B"]);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn forgetting_removes_exactly_one_entry_and_never_the_open_project() {
        let dir = scratch("forget");
        let main = project_file(&dir, "main.cjcp");
        let second = project_file(&dir, "second.cjcp");
        let third = project_file(&dir, "third.cjcp");

        let mut session = Session {
            recent: vec![
                recent("Main", &main),
                recent("Second", &second),
                recent("Third", &third),
            ],
            ..Default::default()
        };

        assert!(
            forget_recent(
                &mut session,
                Some(main.as_path()),
                &second.display().to_string()
            ),
            "a non-open entry is removable"
        );
        assert_eq!(
            session
                .recent
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            ["Main", "Third"],
            "exactly one entry is gone"
        );

        assert!(
            !forget_recent(
                &mut session,
                Some(main.as_path()),
                &main.display().to_string()
            ),
            "the open project is never removed"
        );
        assert_eq!(session.recent.len(), 2);

        assert!(
            !forget_recent(
                &mut session,
                Some(main.as_path()),
                &second.display().to_string()
            ),
            "forgetting an absent entry changes nothing"
        );
        assert_eq!(session.recent.len(), 2);

        assert!(
            main.exists() && third.exists(),
            "files on disk are untouched"
        );

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_missing_file_is_flagged_until_it_can_be_read_again() {
        let dir = scratch("missing");
        let path = dir.join("restored.cjcp");

        assert!(is_missing(&path), "absent");
        std::fs::write(&path, b"{}").expect("project file");
        assert!(!is_missing(&path), "present and readable");

        std::fs::remove_file(&path).expect("remove");
        assert!(is_missing(&path), "removed again");

        assert!(is_missing(&dir), "a directory is not a readable project");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_empty_state_is_the_contract_sentence() {
        assert_eq!(
            NO_RECENTS,
            "No recent projects. Open a .cjcp from the command line and it appears here."
        );
        assert!(build(None, &[]).is_empty());
    }
}
