//! Operator commands and the keys that invoke them.
//!
//! The bindings are FreeShow's controller bindings, not invented ones: an
//! operator moving between the reference and this app must not have to relearn
//! the keyboard. See the reference's `src/server/controller/App.svelte`.

/// Something an operator can ask the show to do.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Command {
    Next,
    Previous,
    NextGroup,
    PreviousGroup,
    NextSection,
    PreviousSection,
    First,
    Last,
    /// Blank the output. Navigation restores it, as it does in FreeShow.
    Clear,
    /// Show the live slide again without moving.
    Restore,
}

impl Command {
    /// The command a `KeyboardEvent.key` invokes, if any.
    pub fn from_key(key: &str) -> Option<Self> {
        match key {
            " " | "ArrowRight" | "PageDown" => Some(Command::Next),
            "ArrowLeft" | "PageUp" => Some(Command::Previous),
            "Escape" => Some(Command::Clear),
            _ => None,
        }
    }

    /// Keys that must not scroll or activate a focused button when bound.
    pub fn captures_key(key: &str) -> bool {
        Self::from_key(key).is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_bindings_are_freeshows_controller_bindings() {
        for key in [" ", "ArrowRight", "PageDown"] {
            assert_eq!(Command::from_key(key), Some(Command::Next), "{key:?}");
        }
        for key in ["ArrowLeft", "PageUp"] {
            assert_eq!(Command::from_key(key), Some(Command::Previous), "{key:?}");
        }
        assert_eq!(Command::from_key("Escape"), Some(Command::Clear));
    }

    #[test]
    fn unbound_keys_do_nothing() {
        for key in ["a", "ArrowUp", "ArrowDown", "Enter", "Home", "End"] {
            assert_eq!(Command::from_key(key), None, "{key:?}");
        }
    }

    #[test]
    fn a_bound_key_is_captured_and_an_unbound_one_is_not() {
        assert!(Command::captures_key(" "));
        assert!(!Command::captures_key("Tab"));
    }
}
