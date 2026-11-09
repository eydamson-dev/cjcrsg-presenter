//! A thread-safe handle to the show engine.
//!
//! The window registry and the UI are single-threaded, but the engine is not:
//! the remote control server runs on its own thread and must be able to
//! advance the show. Everything shared across that boundary lives here.

use std::sync::{Arc, Mutex, MutexGuard};

use tokio::sync::watch;

use crate::engine::ShowEngine;
use crate::render::{RenderState, Revision};

/// The authoritative presentation state, shareable across threads.
#[derive(Debug)]
pub struct SharedEngine {
    inner: Mutex<ShowEngine>,
    hub: watch::Sender<Arc<RenderState>>,
}

impl SharedEngine {
    pub fn new(engine: ShowEngine) -> Self {
        let (hub, _rx) = watch::channel(Arc::new(engine.state()));
        Self {
            inner: Mutex::new(engine),
            hub,
        }
    }

    fn lock(&self) -> MutexGuard<'_, ShowEngine> {
        // A poisoned lock means another thread panicked mid-update. Recover
        // rather than cascade: the state is still readable, and a presentation
        // must not die because a diagnostic thread did.
        self.inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn apply_engine(&self, change: impl FnOnce(&mut ShowEngine) -> bool) -> bool {
        let mut engine = self.lock();
        let changed = change(&mut engine);
        if changed {
            self.hub.send_replace(Arc::new(engine.state()));
        }
        changed
    }

    pub fn next_slide(&self) -> bool {
        self.apply_engine(ShowEngine::next_slide)
    }

    pub fn previous_slide(&self) -> bool {
        self.apply_engine(ShowEngine::previous_slide)
    }

    pub fn first_slide(&self) -> bool {
        self.apply_engine(|engine| engine.go_to_index(0))
    }

    pub fn last_slide(&self) -> bool {
        self.apply_engine(|engine| {
            let last = engine.len().saturating_sub(1);
            engine.go_to_index(last)
        })
    }

    pub fn next_group(&self) -> bool {
        self.apply_engine(ShowEngine::next_group)
    }

    pub fn previous_group(&self) -> bool {
        self.apply_engine(ShowEngine::previous_group)
    }

    /// Apply an operator command; see [`crate::input::Command`].
    pub fn apply(&self, command: crate::input::Command) -> bool {
        self.apply_engine(|engine| engine.apply(command))
    }

    /// Set or clear the stage-only operator message.
    pub fn set_message(&self, message: Option<&str>) -> bool {
        let message = message.map(str::to_string);
        self.apply_engine(|engine| engine.set_message(message.as_deref()))
    }

    pub fn set_stage_layout(&self, layout: crate::render::StageLayout) -> bool {
        self.apply_engine(|engine| engine.set_stage_layout(layout))
    }

    pub fn set_timer(&self, seconds: u64) -> bool {
        self.apply_engine(|engine| engine.set_timer(seconds))
    }

    pub fn start_timer(&self) -> bool {
        self.apply_engine(ShowEngine::start_timer)
    }

    pub fn pause_timer(&self) -> bool {
        self.apply_engine(ShowEngine::pause_timer)
    }

    pub fn reset_timer(&self) -> bool {
        self.apply_engine(ShowEngine::reset_timer)
    }

    pub fn clear_timer(&self) -> bool {
        self.apply_engine(ShowEngine::clear_timer)
    }

    pub fn set_cleared(&self, cleared: bool) -> bool {
        self.apply_engine(|engine| engine.set_cleared(cleared))
    }

    pub fn toggle_clear(&self) -> bool {
        self.apply_engine(ShowEngine::toggle_clear)
    }

    pub fn is_cleared(&self) -> bool {
        self.lock().is_cleared()
    }

    pub fn go_to_index(&self, index: usize) -> bool {
        self.apply_engine(|engine| engine.go_to_index(index))
    }

    /// The last published state. Cheap, and enough for hot readers.
    pub fn state(&self) -> Arc<RenderState> {
        self.hub.borrow().clone()
    }

    /// The state *now*, including the live slide's current media position.
    ///
    /// The hub caches what was published; a navigation publishes position zero,
    /// which is right at that moment and wrong a minute later. A window that
    /// opens mid-clip must ask for this one.
    pub fn snapshot(&self) -> Arc<RenderState> {
        let engine = self.lock();
        Arc::new(engine.state())
    }

    /// Snapshot and cursor read under one lock, so a navigation between the two
    /// cannot make the remote disagree with itself.
    pub fn snapshot_with_cursor(&self) -> (Arc<RenderState>, (String, usize, usize)) {
        let engine = self.lock();
        let state = engine.state();
        let cursor = (state.slide_id.clone(), engine.index() + 1, engine.len());
        (Arc::new(state), cursor)
    }

    pub fn revision(&self) -> Revision {
        self.hub.borrow().revision
    }

    /// `(slide id, 1-based position, total)` for readouts.
    pub fn cursor(&self) -> (String, usize, usize) {
        let engine = self.lock();
        let state = engine.state();
        (state.slide_id, engine.index() + 1, engine.len())
    }

    pub fn len(&self) -> usize {
        self.lock().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn subscribe(&self) -> watch::Receiver<Arc<RenderState>> {
        self.hub.subscribe()
    }

    pub fn project(&self) -> crate::domain::Project {
        self.lock().project().clone()
    }

    /// Replace the loaded project and publish, even when the new one is empty:
    /// outputs showing the old project must be blanked, not left stale.
    pub fn replace_project(&self, project: crate::domain::Project) -> bool {
        self.replace_project_at(project, None)
    }

    /// Replace the project and its media folder in one published revision, so
    /// an output never renders the new slides against the old root.
    pub fn replace_project_at(
        &self,
        project: crate::domain::Project,
        media_root: Option<std::path::PathBuf>,
    ) -> bool {
        let mut loaded = false;
        self.apply_engine(|engine| {
            loaded = engine.replace_project_at(project, media_root);
            true
        });
        loaded
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Project, Show, Slide, SlideGroup};

    fn engine() -> ShowEngine {
        let slide = |id: &str| Slide {
            id: id.to_string(),
            name: id.to_string(),
            ..Default::default()
        };
        let project = Project {
            id: "p".into(),
            name: "P".into(),
            shows: vec![Show {
                id: "s".into(),
                name: "S".into(),
                groups: vec![SlideGroup {
                    id: "g".into(),
                    name: "G".into(),
                    slides: vec![slide("a"), slide("b"), slide("c")],
                    ..Default::default()
                }],
                ..Default::default()
            }],
            ..Default::default()
        };
        ShowEngine::new(project)
    }

    #[test]
    fn publishes_on_every_change() {
        let shared = SharedEngine::new(engine());
        assert_eq!(shared.revision(), 0);
        assert!(shared.next_slide());
        assert_eq!(shared.revision(), 1);
        assert_eq!(shared.state().slide_id, "b");
    }

    #[test]
    fn no_op_commands_do_not_publish() {
        let shared = SharedEngine::new(engine());
        assert!(!shared.previous_slide());
        assert_eq!(shared.revision(), 0);
    }

    #[test]
    fn last_slide_jumps_to_the_end() {
        let shared = SharedEngine::new(engine());
        assert!(shared.last_slide());
        assert_eq!(shared.state().slide_id, "c");
        assert!(!shared.last_slide());
    }

    #[test]
    fn first_slide_jumps_to_the_start() {
        let shared = SharedEngine::new(engine());
        shared.last_slide();
        assert!(shared.first_slide());
        assert_eq!(shared.state().slide_id, "a");
    }

    #[test]
    fn subscribers_see_published_state() {
        let shared = Arc::new(SharedEngine::new(engine()));
        let receiver = shared.subscribe();
        shared.next_slide();
        assert_eq!(receiver.borrow().revision, 1);
    }

    #[test]
    fn a_snapshot_reports_the_current_media_position_while_the_cache_does_not() {
        use crate::clock::ManualClock;
        use crate::domain::{MediaRef, SlideElement};
        use crate::media::{MediaKind, MediaOrigin};
        use std::sync::Arc;

        let clock = ManualClock::new();
        let mut engine = engine();
        {
            let mut project = engine.project().clone();
            project.shows[0].groups[0].slides[0]
                .elements
                .push(SlideElement {
                    id: "clip".into(),
                    class_name: "media".into(),
                    media: Some(MediaRef {
                        path: "/srv/clip.webm".into(),
                        kind: MediaKind::Video,
                        origin: MediaOrigin::External,
                        looped: false,
                        muted: true,
                    }),
                    ..Default::default()
                });
            engine.replace_project(project);
        }
        let shared = SharedEngine::new(engine.with_clock(Arc::new(clock.clone())));

        clock.advance(1200);
        let position = |state: &crate::render::RenderState| {
            state
                .slide
                .elements
                .last()
                .unwrap()
                .media
                .as_ref()
                .unwrap()
                .position_ms
        };
        assert_eq!(
            position(&shared.snapshot()),
            1200,
            "fresh, for a window opening now"
        );
        assert_eq!(
            position(&shared.state()),
            0,
            "the cached state keeps the position from when it was published"
        );
    }

    #[test]
    fn replacing_a_project_publishes_even_when_the_new_one_is_empty() {
        let shared = SharedEngine::new(engine());
        let before = shared.revision();
        assert!(!shared.replace_project(Project::default()));
        assert_eq!(shared.revision(), before + 1);
        assert!(shared.state().slide.is_blank());
    }

    #[test]
    fn is_send_and_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<SharedEngine>();
    }

    #[test]
    fn concurrent_advances_serialise() {
        let shared = Arc::new(SharedEngine::new(engine()));
        let mut handles = Vec::new();
        for _ in 0..8 {
            let shared = shared.clone();
            handles.push(std::thread::spawn(move || {
                // Two advances each; only two are possible before the end.
                shared.next_slide();
                shared.next_slide();
            }));
        }
        for handle in handles {
            handle.join().unwrap();
        }
        // Eight threads of two advances cannot exceed the two real advances;
        // the count must be exactly the number of successful transitions.
        assert_eq!(shared.revision(), 2);
        assert_eq!(shared.state().slide_id, "c");
    }
}
