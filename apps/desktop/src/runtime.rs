//! Application state and the output-window registry.

use std::collections::HashMap;
use std::rc::{Rc, Weak};
use std::sync::{Arc, Mutex, OnceLock};

use dioxus_desktop::DesktopService;
use presenter_core::{
    Project, RecentProject, Revision, Session, SessionStore, SharedEngine, Show, ShowEngine, Slide,
    SlideElement, SlideGroup,
};

/// The four outputs a service needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum OutputKind {
    Audience,
    Stage,
    Preview,
    Confidence,
}

impl OutputKind {
    pub const ALL: [OutputKind; 4] = [
        OutputKind::Audience,
        OutputKind::Stage,
        OutputKind::Preview,
        OutputKind::Confidence,
    ];

    pub fn label(self) -> &'static str {
        match self {
            OutputKind::Audience => "Audience",
            OutputKind::Stage => "Stage",
            OutputKind::Preview => "Preview",
            OutputKind::Confidence => "Confidence",
        }
    }
}

/// `Rc<AppState>` in props, with identity equality.
///
/// `RenderHub` is not `PartialEq`, and comparing two `Rc`s by value would be
/// wrong anyway — props compare should ask "is this the same state object".
#[derive(Clone)]
pub struct Shared(pub Rc<AppState>);

impl PartialEq for Shared {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}

impl std::fmt::Debug for Shared {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Shared").finish_non_exhaustive()
    }
}

pub struct AppState {
    pub engine: Arc<SharedEngine>,
    /// Windows are held weakly on purpose: the registry must never be the reason
    /// a window stays alive. A dead weak reference means "closed".
    windows: Mutex<HashMap<OutputKind, Weak<DesktopService>>>,
    /// Last revision each output reported applying.
    applied: Mutex<HashMap<OutputKind, Revision>>,
    /// Where recent projects are remembered. Cached in memory so a re-render
    /// does not touch the disk every 250 ms.
    store: SessionStore,
    session: Mutex<Session>,
    /// The project's sections and shows, built once per open. Rendering the
    /// controller must not clone the whole project every 250 ms.
    outline: Mutex<Vec<crate::outline::OutlineEntry>>,
    /// The project's media, resolved once per open.
    media: Mutex<Vec<crate::media_panel::MediaItem>>,
    /// The file this project came from, if any. Needed to write it back.
    project_path: Mutex<Option<std::path::PathBuf>>,
}

impl AppState {
    pub fn new() -> Self {
        let store = session_store();
        let session = store.load();
        let engine = shared_engine();
        // Apply the remembered end-of-show setting before the first render, or
        // the control would show one state and the engine behave as another.
        engine.set_next_item_on_last_slide(session.next_item_on_last_slide);
        let project = engine.project();
        let outline = crate::outline::build(&project);
        let media = crate::media_panel::build(&project, media_root_hint());
        Self {
            engine,
            windows: Mutex::new(HashMap::new()),
            applied: Mutex::new(HashMap::new()),
            store,
            session: Mutex::new(session),
            outline: Mutex::new(outline),
            media: Mutex::new(media),
            project_path: Mutex::new(startup_project_path()),
        }
    }

    pub fn project_path(&self) -> Option<std::path::PathBuf> {
        self.project_path.lock().expect("path lock").clone()
    }

    /// Copy the project's external media into it and write the file back.
    ///
    /// Re-opens afterwards so the engine, the media allowlist and the outline
    /// all see the relative paths.
    pub fn bundle_media(&self) -> Result<String, String> {
        let Some(path) = self.project_path() else {
            return Err("This project has not been saved to a file yet.".to_string());
        };
        let summary = bundle_project_file(&path)?;
        self.open_project(&path)?;
        Ok(summary)
    }

    pub fn column_widths(&self) -> (u32, u32) {
        let session = self.session.lock().expect("session lock");
        (session.layout.left_width, session.layout.right_width)
    }

    /// Persist the controller's column widths. Clamped here as well as in the
    /// page, because a saved file can be edited.
    pub fn set_column_widths(&self, left: u32, right: u32) {
        let mut session = self.session.lock().expect("session lock");
        let prefs = session.layout.with_columns(left, right);
        if session.layout == prefs {
            return;
        }
        session.layout = prefs;
        if let Err(error) = self.store.save(&session) {
            tracing::warn!(%error, "could not save column widths");
        }
    }

    /// The remembered drawer open height, clamped for a hand-edited session.
    pub fn drawer_remembered_height(&self) -> u32 {
        match self.session.lock() {
            Ok(session) => session.layout.remembered_drawer_height(),
            Err(_) => presenter_core::DEFAULT_DRAWER_HEIGHT,
        }
    }

    /// Persist the height a collapsed or released drawer should reopen at.
    pub fn set_drawer_height(&self, height: u32) {
        let mut session = match self.session.lock() {
            Ok(session) => session,
            Err(_) => return,
        };
        let clamped = height.clamp(
            presenter_core::MIN_DRAWER_HEIGHT,
            presenter_core::MAX_DRAWER_HEIGHT,
        );
        if session.layout.drawer_height == clamped {
            return;
        }
        session.layout.drawer_height = clamped;
        if let Err(error) = self.store.save(&session) {
            tracing::warn!(%error, "could not save the drawer height");
        }
    }

    /// The live end-of-show setting. The engine owns it; the session remembers
    /// it between launches.
    pub fn next_item_on_last_slide(&self) -> bool {
        self.engine.next_item_on_last_slide()
    }

    /// Apply the operator's end-of-show choice and remember it, the same way
    /// column widths are remembered. The engine changes even if the file cannot
    /// be written; a failed save is logged, not fatal.
    pub fn set_next_item_on_last_slide(&self, enabled: bool) {
        if !self.engine.set_next_item_on_last_slide(enabled) {
            return;
        }
        let mut session = match self.session.lock() {
            Ok(session) => session,
            Err(_) => {
                tracing::warn!("could not save the end-of-show setting; session lock poisoned");
                return;
            }
        };
        if session.next_item_on_last_slide == enabled {
            return;
        }
        session.next_item_on_last_slide = enabled;
        if let Err(error) = self.store.save(&session) {
            tracing::warn!(%error, "could not save the end-of-show setting");
        }
    }

    pub fn media(&self) -> Vec<crate::media_panel::MediaItem> {
        self.media.lock().expect("media lock").clone()
    }

    pub fn project_name(&self) -> String {
        self.engine.project_name()
    }

    /// The live slide, for the controller preview.
    pub fn slide(&self) -> presenter_core::RenderSlide {
        self.engine.snapshot().slide.clone()
    }

    pub fn outline(&self) -> Vec<crate::outline::OutlineEntry> {
        self.outline.lock().expect("outline lock").clone()
    }

    pub fn current_show(&self) -> Option<usize> {
        self.engine.current_show()
    }

    /// The show the operator has selected, which a next-at-the-end press moves
    /// before the output follows.
    pub fn selected_show(&self) -> Option<usize> {
        self.engine.selected_show()
    }

    pub fn go_to_show(&self, show: usize) -> bool {
        self.engine.go_to_show(show)
    }

    /// Recently opened projects, newest first.
    pub fn recent(&self) -> Vec<RecentProject> {
        self.session.lock().expect("session lock").recent.clone()
    }

    /// Forget one recent project. Never the open project, never the file.
    ///
    /// The in-memory list changes even if the session file cannot be written:
    /// the panel has already been asked to drop the row, and losing a
    /// convenience list is not worth failing the interaction. The save error is
    /// logged rather than panicking (P4).
    pub fn forget_recent(&self, path: &str) -> bool {
        let open = self.project_path();
        let mut session = match self.session.lock() {
            Ok(session) => session,
            Err(_) => {
                tracing::warn!("could not forget a recent project; session lock poisoned");
                return false;
            }
        };
        if !crate::projects::forget_recent(&mut session, open.as_deref(), path) {
            return false;
        }
        if let Err(error) = self.store.save(&session) {
            tracing::warn!(%error, "could not save the recent-projects list");
        }
        true
    }

    /// Open a `.cjcp`, making it live for every output and remembering it.
    ///
    /// Synchronous on purpose: reading a project is a few milliseconds, and the
    /// controller has no busy state to show while it happens.
    pub fn open_project(&self, path: &std::path::Path) -> Result<(), String> {
        let document = presenter_compat::cjcp::read(path)
            .map_err(|error| format!("cannot open {}: {error}", path.display()))?;

        let name = document.project.name.clone();
        *self.project_path.lock().expect("path lock") =
            Some(std::path::absolute(path).unwrap_or_else(|_| path.to_path_buf()));
        let root = std::path::absolute(path)
            .ok()
            .and_then(|absolute| absolute.parent().map(|parent| parent.to_path_buf()));

        // Allow the new project's files before publishing it: an output must
        // never render a URL the server would refuse.
        media_server().access.allow_project(
            &document.project,
            root.as_deref().unwrap_or_else(|| std::path::Path::new(".")),
        );
        *self.outline.lock().expect("outline lock") = crate::outline::build(&document.project);
        *self.media.lock().expect("media lock") =
            crate::media_panel::build(&document.project, root.as_deref());
        self.engine.replace_project_at(document.project, root);

        let absolute = std::path::absolute(path)
            .unwrap_or_else(|_| path.to_path_buf())
            .display()
            .to_string();

        match self.store.record(&absolute, &name) {
            Ok(session) => {
                *self.session.lock().expect("session lock") = session;
                tracing::info!(path = %absolute, project = %name, "project opened");
                Ok(())
            }
            Err(error) => {
                // The project is open and usable; failing the open because the
                // recent list could not be saved would be absurd.
                tracing::warn!(%error, "could not save the recent-projects list");
                Ok(())
            }
        }
    }

    // ---- presentation commands -------------------------------------------------

    /// Apply an operator command from the keyboard or a button.
    pub fn apply(&self, command: presenter_core::Command) -> bool {
        self.engine.apply(command)
    }

    pub fn set_message(&self, message: Option<&str>) -> bool {
        self.engine.set_message(message)
    }

    pub fn next_section(&self) -> bool {
        self.engine.next_section()
    }

    pub fn previous_section(&self) -> bool {
        self.engine.previous_section()
    }

    pub fn set_stage_layout(&self, layout: presenter_core::StageLayout) -> bool {
        self.engine.set_stage_layout(layout)
    }

    pub fn set_timer(&self, seconds: u64) -> bool {
        self.engine.set_timer(seconds)
    }

    pub fn start_timer(&self) -> bool {
        self.engine.start_timer()
    }

    pub fn pause_timer(&self) -> bool {
        self.engine.pause_timer()
    }

    pub fn clear_timer(&self) -> bool {
        self.engine.clear_timer()
    }

    pub fn next_slide(&self) -> bool {
        self.engine.next_slide()
    }

    pub fn previous_slide(&self) -> bool {
        self.engine.previous_slide()
    }

    pub fn first_slide(&self) -> bool {
        self.engine.first_slide()
    }

    pub fn revision(&self) -> Revision {
        self.engine.revision()
    }

    /// `(slide id, position, total)` for the controller readout.
    pub fn cursor(&self) -> (String, usize, usize) {
        self.engine.cursor()
    }

    // ---- output registry -------------------------------------------------------

    pub fn register(&self, kind: OutputKind, window: Weak<DesktopService>) {
        self.windows
            .lock()
            .expect("windows lock")
            .insert(kind, window);
    }

    pub fn forget(&self, kind: OutputKind) {
        self.windows.lock().expect("windows lock").remove(&kind);
        self.applied.lock().expect("applied lock").remove(&kind);
    }

    pub fn is_open(&self, kind: OutputKind) -> bool {
        self.windows
            .lock()
            .expect("windows lock")
            .get(&kind)
            .and_then(Weak::upgrade)
            .is_some()
    }

    /// Ask a window to close. Returns whether a live window was found.
    pub fn close_output(&self, kind: OutputKind) -> bool {
        let window = self
            .windows
            .lock()
            .expect("windows lock")
            .get(&kind)
            .and_then(Weak::upgrade);

        match window {
            Some(window) => {
                window.close();
                true
            }
            None => {
                self.forget(kind);
                false
            }
        }
    }

    /// Called by an output window when it finishes applying a revision.
    pub fn report_applied(&self, kind: OutputKind, revision: Revision) {
        self.applied
            .lock()
            .expect("applied lock")
            .insert(kind, revision);
    }

    pub fn applied(&self, kind: OutputKind) -> Option<Revision> {
        self.applied
            .lock()
            .expect("applied lock")
            .get(&kind)
            .copied()
    }
}

/// The one engine every window and the remote server share.
///
/// A process-wide singleton because the remote control thread must reach the
/// same instance the windows do; two engines would mean two shows.
static SHARED: OnceLock<Arc<SharedEngine>> = OnceLock::new();

/// The file the app opened at launch, when it came from one.
static STARTUP_PATH: OnceLock<std::path::PathBuf> = OnceLock::new();

pub fn startup_project_path() -> Option<std::path::PathBuf> {
    STARTUP_PATH.get().cloned()
}

fn media_root_hint() -> Option<&'static std::path::Path> {
    STARTUP_PATH
        .get()
        .and_then(|path| path.parent())
        .map(|parent| parent as &'static std::path::Path)
}

/// The loopback server that lets the WebViews load project media. Started once,
/// before the engine exists, because the engine's media URLs contain its port.
static MEDIA: OnceLock<crate::media_server::MediaServer> = OnceLock::new();

pub fn media_server() -> &'static crate::media_server::MediaServer {
    MEDIA.get_or_init(crate::media_server::start)
}

pub fn shared_engine() -> Arc<SharedEngine> {
    SHARED
        .get_or_init(|| {
            let server = media_server();
            let engine = match load_project() {
                Some((project, root)) => {
                    server.access.allow_project(&project, &root);
                    ShowEngine::new(project)
                        .with_media_root(root)
                        .with_media_base(server.base_url())
                }
                None => ShowEngine::new(demo_project()).with_media_base(server.base_url()),
            };
            Arc::new(SharedEngine::new(engine))
        })
        .clone()
}

/// The session file, in the platform's application-data directory.
///
/// `CJCRSG_DATA_DIR` overrides it, so a test or a demonstration never reads or
/// writes the operator's real list.
pub fn session_store() -> SessionStore {
    let directory = std::env::var_os("CJCRSG_DATA_DIR")
        .map(std::path::PathBuf::from)
        .or_else(|| dirs::data_dir().map(|base| base.join("cjcrsg-presenter")))
        .unwrap_or_else(|| std::path::PathBuf::from(".cjcrsg-presenter"));

    SessionStore::at(directory.join("session.json"))
}

/// The project to open at launch: the command-line path, else the last one
/// opened. A stale entry falls back to the demo rather than an error screen.
fn load_project() -> Option<(Project, std::path::PathBuf)> {
    let store = session_store();
    let explicit = std::env::var("CJCRSG_PROJECT").ok();
    let path = explicit
        .clone()
        .or_else(|| store.load().last().map(|entry| entry.path.clone()))?;

    match presenter_compat::cjcp::read(std::path::Path::new(&path)) {
        Ok(document) => {
            tracing::info!(
                path = %path,
                project = %document.project.name,
                slides = document.project.slide_count(),
                "project loaded"
            );
            if explicit.is_some() {
                // Opening from the command line counts as opening it.
                if let Err(error) = store.record(&path, &document.project.name) {
                    tracing::warn!(%error, "could not record the project as recent");
                }
            }
            // Media paths in a `.cjcp` are relative to the file's folder.
            let absolute = std::path::absolute(std::path::Path::new(&path)).ok();
            let root = absolute
                .as_ref()
                .and_then(|absolute| absolute.parent().map(|parent| parent.to_path_buf()))
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            if let Some(absolute) = absolute {
                let _ = STARTUP_PATH.set(absolute);
            }
            Some((document.project, root))
        }
        Err(error) => {
            tracing::error!(path = %path, %error, "could not load project; falling back to demo");
            None
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Stand-in content until `crates/compat` can read a real `.show` file.
///
/// Twelve slides: enough to run ten `NEXT` commands and still have headroom,
/// which is exactly what the Experiment 1 procedure requires.
fn demo_project() -> Project {
    fn slide(id: String, name: String, text: String) -> Slide {
        Slide {
            elements: vec![SlideElement {
                id: format!("{id}-text"),
                text,
                class_name: "lyrics".into(),
                style: String::new(),
                ..Default::default()
            }],
            id,
            name,
            ..Default::default()
        }
    }

    let mut worship = Vec::new();
    for index in 1..=8 {
        worship.push(slide(
            format!("lyric-{index}"),
            format!("Verse {index}"),
            format!("Line one of lyric slide {index}\nLine two of lyric slide {index}"),
        ));
    }

    let mut points = Vec::new();
    for index in 1..=4 {
        points.push(slide(
            format!("point-{index}"),
            format!("Point {index}"),
            format!("Sermon point {index}"),
        ));
    }

    Project {
        id: "demo".into(),
        name: "Experiment 1".into(),
        shows: vec![Show {
            id: "demo-show".into(),
            name: "Sunday Service".into(),
            groups: vec![
                SlideGroup {
                    id: "worship".into(),
                    name: "Worship".into(),
                    slides: worship,
                    ..Default::default()
                },
                SlideGroup {
                    id: "sermon".into(),
                    name: "Sermon".into(),
                    slides: points,
                    ..Default::default()
                },
            ],
            ..Default::default()
        }],
        ..Default::default()
    }
}

/// Bundle a `.cjcp` in place. Split out of [`AppState`] so it can be tested
/// without a window, an engine or the process-wide media server.
pub fn bundle_project_file(path: &std::path::Path) -> Result<String, String> {
    let root = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| std::path::Path::new("."));

    let mut document = presenter_compat::cjcp::read(path)
        .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let report = presenter_core::bundle_media(&mut document.project, root);
    presenter_compat::cjcp::write(path, &document)
        .map_err(|error| format!("cannot write {}: {error}", path.display()))?;

    let mut summary = format!("copied {}", report.copied());
    if !report.missing.is_empty() {
        summary.push_str(&format!(", missing {}", report.missing.len()));
    }
    if !report.failed.is_empty() {
        summary.push_str(&format!(", failed {}", report.failed.len()));
    }
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundling_a_project_file_copies_and_rewrites_in_place() {
        let root = std::env::temp_dir().join(format!("cjcp-bundle-app-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("outside")).unwrap();
        let clip = root.join("outside/clip.mp4");
        std::fs::write(&clip, b"video bytes").unwrap();

        let project = presenter_core::Project {
            id: "p".into(),
            name: "Sunday".into(),
            media: vec![presenter_core::MediaAsset::external(
                "m1",
                presenter_core::MediaKind::Video,
                clip.to_string_lossy().to_string(),
            )],
            ..Default::default()
        };
        let path = root.join("sunday.cjcp");
        presenter_compat::cjcp::write(&path, &presenter_compat::cjcp::Document::new(project))
            .unwrap();

        let summary = bundle_project_file(&path).unwrap();
        assert_eq!(summary, "copied 1");

        let document = presenter_compat::cjcp::read(&path).unwrap();
        assert_eq!(document.project.media[0].path, "media/clip.mp4");
        assert_eq!(
            std::fs::read(root.join("media/clip.mp4")).unwrap(),
            b"video bytes"
        );

        std::fs::remove_dir_all(&root).ok();
    }
}
