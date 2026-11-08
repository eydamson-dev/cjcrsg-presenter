//! Application state and the output-window registry.

use std::collections::HashMap;
use std::rc::{Rc, Weak};
use std::sync::Mutex;

use dioxus_desktop::DesktopService;
use presenter_core::{
    Project, RenderHub, Revision, Show, ShowEngine, Slide, SlideElement, SlideGroup,
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
    engine: Mutex<ShowEngine>,
    pub hub: RenderHub,
    /// Windows are held weakly on purpose: the registry must never be the reason
    /// a window stays alive. A dead weak reference means "closed".
    windows: Mutex<HashMap<OutputKind, Weak<DesktopService>>>,
    /// Last revision each output reported applying.
    applied: Mutex<HashMap<OutputKind, Revision>>,
}

impl AppState {
    pub fn new() -> Self {
        let engine = ShowEngine::new(load_project().unwrap_or_else(demo_project));
        let hub = RenderHub::new(engine.state());
        Self {
            engine: Mutex::new(engine),
            hub,
            windows: Mutex::new(HashMap::new()),
            applied: Mutex::new(HashMap::new()),
        }
    }

    // ---- presentation commands -------------------------------------------------

    pub fn next_slide(&self) -> bool {
        let mut engine = self.engine.lock().expect("engine lock");
        let changed = engine.next_slide();
        if changed {
            self.hub.publish(engine.state());
        }
        changed
    }

    pub fn previous_slide(&self) -> bool {
        let mut engine = self.engine.lock().expect("engine lock");
        let changed = engine.previous_slide();
        if changed {
            self.hub.publish(engine.state());
        }
        changed
    }

    pub fn first_slide(&self) -> bool {
        let mut engine = self.engine.lock().expect("engine lock");
        let changed = engine.go_to_index(0);
        if changed {
            self.hub.publish(engine.state());
        }
        changed
    }

    pub fn revision(&self) -> Revision {
        self.hub.revision()
    }

    /// `(slide id, position, total)` for the controller readout.
    pub fn cursor(&self) -> (String, usize, usize) {
        let engine = self.engine.lock().expect("engine lock");
        let state = engine.state();
        (state.slide_id, engine.index() + 1, engine.len())
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

/// Load `CJCRSG_PROJECT` when the app was started with a `.cjcp` path.
fn load_project() -> Option<Project> {
    let path = std::env::var("CJCRSG_PROJECT").ok()?;
    match presenter_compat::cjcp::read(std::path::Path::new(&path)) {
        Ok(document) => {
            tracing::info!(
                path = %path,
                project = %document.project.name,
                slides = document.project.slide_count(),
                "project loaded"
            );
            Some(document.project)
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
