//! What the application remembers between launches.
//!
//! Deliberately small and local: a list of recently opened projects, newest
//! first. It is *not* project data — paths here are absolute and machine
//! specific, and losing this file costs the user nothing but a click.
//!
//! The store never fails an operation that the caller cannot act on: a missing
//! or corrupt file reads as an empty session. A presentation application that
//! refuses to start because its recent-projects list is malformed would be
//! worse than one that starts with an empty list.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// How many projects to remember. Enough to cover a week of services.
pub const MAX_RECENT: usize = 10;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Session {
    /// Newest first. `recent[0]` is what "restore on start" opens.
    #[serde(default)]
    pub recent: Vec<RecentProject>,
    /// Controller column widths in pixels.
    #[serde(default)]
    pub layout: LayoutPrefs,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct LayoutPrefs {
    pub left_width: u32,
    pub right_width: u32,
}

impl Default for LayoutPrefs {
    fn default() -> Self {
        Self {
            left_width: 280,
            right_width: 360,
        }
    }
}

impl LayoutPrefs {
    /// Keep both columns usable, whatever a hand-edited session says.
    pub fn clamped(left: u32, right: u32) -> Self {
        Self {
            left_width: left.clamp(200, 480),
            right_width: right.clamp(260, 520),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecentProject {
    /// Display name; the project's own name at the time it was opened.
    pub name: String,
    /// Absolute path, as the user opened it.
    pub path: String,
    /// Unix milliseconds. Informational; ordering comes from the list.
    #[serde(default)]
    pub opened_at: i64,
}

impl Session {
    /// Put `path` at the front, replacing any earlier entry for it.
    pub fn record(&mut self, path: impl Into<String>, name: impl Into<String>, opened_at: i64) {
        let path = path.into();
        self.recent.retain(|entry| entry.path != path);
        self.recent.insert(
            0,
            RecentProject {
                name: name.into(),
                path,
                opened_at,
            },
        );
        self.recent.truncate(MAX_RECENT);
    }

    pub fn forget(&mut self, path: &str) {
        self.recent.retain(|entry| entry.path != path);
    }

    pub fn last(&self) -> Option<&RecentProject> {
        self.recent.first()
    }
}

/// A session file at a fixed path. The caller decides where that is.
#[derive(Debug, Clone)]
pub struct SessionStore {
    path: PathBuf,
}

impl SessionStore {
    pub fn at(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Read the file, or an empty session when it is absent or unreadable.
    pub fn load(&self) -> Session {
        let Ok(json) = std::fs::read_to_string(&self.path) else {
            return Session::default();
        };
        match serde_json::from_str(&json) {
            Ok(session) => session,
            Err(error) => {
                tracing::warn!(
                    path = %self.path.display(),
                    %error,
                    "session file is not readable; starting with an empty list"
                );
                Session::default()
            }
        }
    }

    /// Write through a temporary file so a crash mid-write cannot leave a
    /// half-written session behind.
    pub fn save(&self, session: &Session) -> std::io::Result<()> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(session)?;
        let temporary = self.path.with_extension("json.tmp");
        std::fs::write(&temporary, json)?;
        rename_over(&temporary, &self.path)
    }

    /// Load, record, save, and return the new session.
    pub fn record(&self, path: &str, name: &str) -> std::io::Result<Session> {
        let mut session = self.load();
        session.record(path, name, now_ms());
        self.save(&session)?;
        Ok(session)
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0)
}

/// `rename` replaces an existing file on Unix but not on Windows.
fn rename_over(from: &Path, to: &Path) -> std::io::Result<()> {
    match std::fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(error) if to.exists() => {
            std::fs::remove_file(to)?;
            std::fs::rename(from, to).map_err(|_| error)
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cjcp-session-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn recording_puts_the_newest_first_and_drops_the_old_entry() {
        let mut session = Session::default();
        session.record("/a/sunday.cjcp", "Sunday", 1);
        session.record("/a/wednesday.cjcp", "Wednesday", 2);
        session.record("/a/sunday.cjcp", "Sunday", 3);

        let paths: Vec<&str> = session.recent.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(paths, ["/a/sunday.cjcp", "/a/wednesday.cjcp"]);
        assert_eq!(session.recent[0].opened_at, 3, "re-opening refreshes it");
        assert_eq!(session.last().unwrap().name, "Sunday");
    }

    #[test]
    fn the_list_is_capped() {
        let mut session = Session::default();
        for index in 0..MAX_RECENT + 5 {
            session.record(
                format!("/p/{index}.cjcp"),
                format!("P{index}"),
                index as i64,
            );
        }
        assert_eq!(session.recent.len(), MAX_RECENT);
        assert_eq!(
            session.recent[0].path,
            format!("/p/{}.cjcp", MAX_RECENT + 4)
        );
    }

    #[test]
    fn a_missing_file_reads_as_an_empty_session() {
        let dir = scratch("missing");
        let store = SessionStore::at(dir.join("session.json"));
        assert_eq!(store.load(), Session::default());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_corrupt_file_reads_as_an_empty_session_rather_than_failing_to_start() {
        let dir = scratch("corrupt");
        let path = dir.join("session.json");
        std::fs::write(&path, "{not json").unwrap();
        assert_eq!(SessionStore::at(&path).load(), Session::default());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_session_round_trips_through_disk() {
        let dir = scratch("roundtrip");
        let store = SessionStore::at(dir.join("nested/session.json"));

        let session = store.record("/p/sunday.cjcp", "Sunday").unwrap();
        assert_eq!(session.recent.len(), 1);
        assert!(session.recent[0].opened_at > 0);

        let reloaded = store.load();
        assert_eq!(reloaded, session, "pretty JSON, readable on both sides");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn saving_twice_replaces_the_file_without_leaving_a_temporary() {
        let dir = scratch("replace");
        let store = SessionStore::at(dir.join("session.json"));
        store.record("/p/a.cjcp", "A").unwrap();
        store.record("/p/b.cjcp", "B").unwrap();

        assert_eq!(store.load().recent.len(), 2);
        assert!(
            !dir.join("session.json.tmp").exists(),
            "the temporary file is gone after a successful save"
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn column_widths_have_defaults_and_are_clamped() {
        let prefs = LayoutPrefs::default();
        assert_eq!((prefs.left_width, prefs.right_width), (280, 360));

        let wide = LayoutPrefs::clamped(9000, 1);
        assert_eq!((wide.left_width, wide.right_width), (480, 260));

        let narrow = LayoutPrefs::clamped(10, 9000);
        assert_eq!((narrow.left_width, narrow.right_width), (200, 520));
    }

    #[test]
    fn a_session_without_layout_reads_default_widths() {
        let json = r#"{"recent":[]}"#;
        let session: Session = serde_json::from_str(json).unwrap();
        assert_eq!(session.layout, LayoutPrefs::default());
    }

    #[test]
    fn forgetting_a_project_removes_it() {
        let mut session = Session::default();
        session.record("/p/a.cjcp", "A", 1);
        session.record("/p/b.cjcp", "B", 2);
        session.forget("/p/b.cjcp");
        assert_eq!(session.recent.len(), 1);
        assert_eq!(session.last().unwrap().path, "/p/a.cjcp");
    }
}
