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

    fn apply(&self, change: impl FnOnce(&mut ShowEngine) -> bool) -> bool {
        let mut engine = self.lock();
        let changed = change(&mut engine);
        if changed {
            self.hub.send_replace(Arc::new(engine.state()));
        }
        changed
    }

    pub fn next_slide(&self) -> bool {
        self.apply(ShowEngine::next_slide)
    }

    pub fn previous_slide(&self) -> bool {
        self.apply(ShowEngine::previous_slide)
    }

    pub fn first_slide(&self) -> bool {
        self.apply(|engine| engine.go_to_index(0))
    }

    pub fn last_slide(&self) -> bool {
        self.apply(|engine| {
            let last = engine.len().saturating_sub(1);
            engine.go_to_index(last)
        })
    }

    pub fn toggle_clear(&self) -> bool {
        self.apply(ShowEngine::toggle_clear)
    }

    pub fn is_cleared(&self) -> bool {
        self.lock().is_cleared()
    }

    pub fn go_to_index(&self, index: usize) -> bool {
        self.apply(|engine| engine.go_to_index(index))
    }

    pub fn state(&self) -> Arc<RenderState> {
        self.hub.borrow().clone()
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
