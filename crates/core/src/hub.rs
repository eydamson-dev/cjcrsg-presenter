//! The single state publisher every output subscribes to.

use std::sync::Arc;

use tokio::sync::watch;

use crate::render::{RenderState, Revision};

/// Fan-out for presentation state.
///
/// `watch` carries the latest value, not a history: an output that missed five
/// revisions only needs the newest one. That is exactly the recovery semantics
/// required when a window is closed mid-service and reopened.
#[derive(Debug, Clone)]
pub struct RenderHub {
    tx: watch::Sender<Arc<RenderState>>,
}

impl RenderHub {
    pub fn new(initial: RenderState) -> Self {
        let (tx, _rx) = watch::channel(Arc::new(initial));
        Self { tx }
    }

    /// The current state, without subscribing.
    pub fn snapshot(&self) -> Arc<RenderState> {
        self.tx.borrow().clone()
    }

    pub fn revision(&self) -> Revision {
        self.tx.borrow().revision
    }

    /// A receiver positioned at the current value.
    ///
    /// Subscribe *before* reading the snapshot when initialising a window: the
    /// receiver is created at the current value, so there is no window between
    /// "I read the state" and "I am listening" in which an update could vanish.
    pub fn subscribe(&self) -> watch::Receiver<Arc<RenderState>> {
        self.tx.subscribe()
    }

    /// Publish a new state. Never blocks, never fails, wakes every subscriber.
    pub fn publish(&self, state: RenderState) {
        // `send_replace` also works when no window is open — which is a normal
        // state of affairs, not an error.
        self.tx.send_replace(Arc::new(state));
    }

    pub fn receiver_count(&self) -> usize {
        self.tx.receiver_count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::render::RenderState;

    fn state(revision: Revision) -> RenderState {
        RenderState {
            revision,
            slide_id: format!("slide-{revision}"),
            ..RenderState::default()
        }
    }

    #[test]
    fn a_new_subscriber_sees_the_current_value() {
        let hub = RenderHub::new(state(3));
        assert_eq!(hub.subscribe().borrow().revision, 3);
        assert_eq!(hub.snapshot().revision, 3);
    }

    #[tokio::test]
    async fn publishing_reaches_every_subscriber() {
        let hub = RenderHub::new(state(0));
        let mut a = hub.subscribe();
        let mut b = hub.subscribe();

        hub.publish(state(1));

        assert!(a.changed().await.is_ok());
        assert!(b.changed().await.is_ok());
        assert_eq!(a.borrow().revision, 1);
        assert_eq!(b.borrow().revision, 1);
    }

    #[test]
    fn publishing_with_no_receivers_is_not_an_error() {
        let hub = RenderHub::new(state(0));
        assert_eq!(hub.receiver_count(), 0);
        hub.publish(state(1));
        assert_eq!(hub.revision(), 1);
    }

    #[tokio::test]
    async fn a_late_subscriber_needs_only_the_latest_value() {
        let hub = RenderHub::new(state(0));
        for revision in 1..=5 {
            hub.publish(state(revision));
        }

        // This is the reopened-window case: no replay, just the current truth.
        let mut late = hub.subscribe();
        assert_eq!(late.borrow().revision, 5);
        assert_eq!(late.borrow().slide_id, "slide-5");

        // And it still receives subsequent changes.
        hub.publish(state(6));
        assert!(late.changed().await.is_ok());
        assert_eq!(late.borrow().revision, 6);
    }

    #[test]
    fn clone_shares_one_publisher() {
        let hub = RenderHub::new(state(0));
        let clone = hub.clone();
        clone.publish(state(2));
        assert_eq!(hub.revision(), 2);
    }
}
