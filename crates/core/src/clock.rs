//! Time, injectable.
//!
//! Playback position is elapsed time, so the engine needs a clock. Injecting it
//! keeps tests deterministic and keeps `Instant` out of the domain.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Milliseconds from an arbitrary but monotonic origin.
pub trait Clock: std::fmt::Debug + Send + Sync {
    fn now_ms(&self) -> u64;
}

/// The real clock: monotonic, unaffected by wall-clock changes.
#[derive(Debug)]
pub struct SystemClock {
    origin: std::time::Instant,
}

impl SystemClock {
    pub fn new() -> Self {
        Self {
            origin: std::time::Instant::now(),
        }
    }
}

impl Default for SystemClock {
    fn default() -> Self {
        Self::new()
    }
}

impl Clock for SystemClock {
    fn now_ms(&self) -> u64 {
        self.origin.elapsed().as_millis() as u64
    }
}

/// A clock a test moves by hand.
#[derive(Debug, Clone, Default)]
pub struct ManualClock(Arc<AtomicU64>);

impl ManualClock {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn advance(&self, milliseconds: u64) {
        self.0.fetch_add(milliseconds, Ordering::SeqCst);
    }

    pub fn set(&self, milliseconds: u64) {
        self.0.store(milliseconds, Ordering::SeqCst);
    }
}

impl Clock for ManualClock {
    fn now_ms(&self) -> u64 {
        self.0.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_manual_clock_moves_only_when_told() {
        let clock = ManualClock::new();
        assert_eq!(clock.now_ms(), 0);
        clock.advance(250);
        assert_eq!(clock.now_ms(), 250);
        clock.set(10);
        assert_eq!(clock.now_ms(), 10);
    }

    #[test]
    fn the_system_clock_moves_forward() {
        let clock = SystemClock::new();
        let first = clock.now_ms();
        std::thread::sleep(std::time::Duration::from_millis(2));
        assert!(clock.now_ms() >= first);
    }
}
