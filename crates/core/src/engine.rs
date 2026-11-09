//! Navigation over a loaded project.
//!
//! Pure state: no IO, no windows, no timers, no media. Every method here must be
//! reachable from `cargo test` without a display server.

use tracing::debug;

use std::path::{Path, PathBuf};

use crate::domain::{MediaRef, Project, Show, Slide, SlideGroup, Transition};
use crate::input::Command;
use crate::render::{
    RenderElement, RenderMedia, RenderSlide, RenderState, Revision, TransitionState,
};

/// A slide's address inside the project.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Position {
    pub show: usize,
    pub group: usize,
    pub slide: usize,
}

/// The authoritative owner of "which slide is live".
///
/// Windows may come and go; this must not care.
#[derive(Debug)]
pub struct ShowEngine {
    project: Project,
    /// Presentable slides in order. Flattening keeps navigation linear and makes
    /// empty groups a non-issue — a group with no slides is simply not addressed.
    order: Vec<Position>,
    index: usize,
    revision: Revision,
    /// Applies when a slide does not declare its own transition. FreeShow's
    /// default text transition: fade, 500 ms, sine.
    policy: Transition,
    transition: Option<TransitionState>,
    /// Blanked output. The show position is untouched: clearing is a display
    /// state, not a navigation event.
    cleared: bool,
    /// Project folder for `Bundled` media. Without it, a relative path cannot
    /// become a URL, and the renderer would resolve it against the page.
    media_root: Option<PathBuf>,
}

impl ShowEngine {
    pub fn new(project: Project) -> Self {
        let order = Self::build_order(&project);
        Self {
            project,
            order,
            index: 0,
            revision: 0,
            policy: Transition::default(),
            transition: None,
            cleared: false,
            media_root: None,
        }
    }

    /// Where this project's bundled media lives.
    pub fn with_media_root(mut self, root: impl Into<PathBuf>) -> Self {
        self.media_root = Some(root.into());
        self
    }

    pub fn media_root(&self) -> Option<&Path> {
        self.media_root.as_deref()
    }

    fn build_order(project: &Project) -> Vec<Position> {
        let mut order = Vec::with_capacity(project.slide_count());
        for (show, show_ref) in project.shows.iter().enumerate() {
            for (group, group_ref) in show_ref.groups.iter().enumerate() {
                for slide in 0..group_ref.slides.len() {
                    order.push(Position { show, group, slide });
                }
            }
        }
        order
    }

    pub fn with_transition_policy(mut self, policy: Transition) -> Self {
        self.policy = policy;
        self
    }

    pub fn project(&self) -> &Project {
        &self.project
    }

    /// Swap in a different project, as when the operator opens another one.
    ///
    /// Resets position and clear state, and publishes one revision with no
    /// transition: opening a project is not a slide change, so it must not
    /// animate. Returns whether the new project has anything to present.
    pub fn replace_project(&mut self, project: Project) -> bool {
        self.replace_project_at(project, None)
    }

    /// Replace the project and, when given, the folder its media resolves
    /// against. One revision, so an output never renders with the old root.
    pub fn replace_project_at(&mut self, project: Project, media_root: Option<PathBuf>) -> bool {
        if media_root.is_some() {
            self.media_root = media_root;
        }
        self.order = Self::build_order(&project);
        self.project = project;
        self.index = 0;
        self.cleared = false;
        self.transition = None;
        self.revision += 1;
        !self.order.is_empty()
    }

    pub fn is_loaded(&self) -> bool {
        !self.order.is_empty()
    }

    pub fn len(&self) -> usize {
        self.order.len()
    }

    pub fn is_empty(&self) -> bool {
        self.order.is_empty()
    }

    pub fn index(&self) -> usize {
        self.index
    }

    pub fn revision(&self) -> Revision {
        self.revision
    }

    pub fn position(&self) -> Option<Position> {
        self.order.get(self.index).copied()
    }

    pub fn current(&self) -> Option<(&Show, &SlideGroup, &Slide)> {
        let position = self.position()?;
        let show = self.project.shows.get(position.show)?;
        let group = show.groups.get(position.group)?;
        let slide = group.slides.get(position.slide)?;
        Some((show, group, slide))
    }

    /// Advance one slide. Returns whether anything changed.
    pub fn next_slide(&mut self) -> bool {
        if self.index + 1 >= self.order.len() {
            debug!("next at final slide; ignoring");
            return false;
        }
        self.index += 1;
        self.bump();
        true
    }

    /// Go back one slide. Returns whether anything changed.
    pub fn previous_slide(&mut self) -> bool {
        if self.index == 0 {
            debug!("previous at first slide; ignoring");
            return false;
        }
        self.index -= 1;
        self.bump();
        true
    }

    /// Jump to the first slide of the next group.
    ///
    /// Operators think in sections ("next song"), not in slide counts, and a
    /// section boundary is not always one slide away.
    pub fn next_group(&mut self) -> bool {
        let Some(current) = self.position() else {
            return false;
        };

        for index in self.index + 1..self.order.len() {
            let candidate = self.order[index];
            if candidate.show != current.show || candidate.group != current.group {
                return self.go_to_index(index);
            }
        }

        false
    }

    /// Jump to the first slide of the previous group.
    pub fn previous_group(&mut self) -> bool {
        let Some(current) = self.position() else {
            return false;
        };

        let mut index = self.index;
        while index > 0 {
            index -= 1;
            let candidate = self.order[index];
            if candidate.show != current.show || candidate.group != current.group {
                // Walk back to the start of that group.
                let mut start = index;
                while start > 0 {
                    let before = self.order[start - 1];
                    if before.show == candidate.show && before.group == candidate.group {
                        start -= 1;
                    } else {
                        break;
                    }
                }
                return self.go_to_index(start);
            }
        }

        false
    }

    /// Jump to a slide by project address. Returns whether anything changed.
    pub fn go_to(&mut self, position: Position) -> bool {
        let Some(target) = self.order.iter().position(|p| *p == position) else {
            debug!(?position, "go_to out of range; ignoring");
            return false;
        };
        self.go_to_index(target)
    }

    pub fn go_to_index(&mut self, index: usize) -> bool {
        if index >= self.order.len() || index == self.index {
            return false;
        }
        self.index = index;
        self.bump();
        true
    }

    pub fn is_cleared(&self) -> bool {
        self.cleared
    }

    /// Blank or restore the output. Returns whether anything changed.
    ///
    /// Clearing is not a slide change, so it uses the project default rather
    /// than the transition the incoming slide declares.
    pub fn toggle_clear(&mut self) -> bool {
        self.cleared = !self.cleared;
        self.revision += 1;
        let policy = self.policy.clone();
        self.transition = Some(self.describe(&policy));
        true
    }

    pub fn set_cleared(&mut self, cleared: bool) -> bool {
        if self.cleared == cleared {
            return false;
        }
        self.toggle_clear()
    }

    #[cfg(test)]
    fn last_slide_for_test(&mut self) {
        let last = self.order.len().saturating_sub(1);
        self.go_to_index(last);
    }

    fn slide_at(&self, position: Position) -> Option<&Slide> {
        self.project
            .shows
            .get(position.show)?
            .groups
            .get(position.group)?
            .slides
            .get(position.slide)
    }

    /// Apply an operator command. Returns whether anything changed.
    pub fn apply(&mut self, command: Command) -> bool {
        match command {
            Command::Next => self.next_slide(),
            Command::Previous => self.previous_slide(),
            Command::NextGroup => self.next_group(),
            Command::PreviousGroup => self.previous_group(),
            Command::First => self.go_to_index(0),
            Command::Last => self.go_to_index(self.order.len().saturating_sub(1)),
            Command::Clear => self.set_cleared(true),
            Command::Restore => self.set_cleared(false),
        }
    }

    fn bump(&mut self) {
        // Navigating reveals the output again. In FreeShow the cleared state is
        // derived from whether an output has content, so any slide change
        // restores it; leaving it blank would make Escape a trap.
        self.cleared = false;
        self.revision += 1;
        // FreeShow resolves the *incoming* slide's transition (slide → style →
        // global). We model the two ends: the slide's own, else the default.
        let transition = self
            .position()
            .and_then(|position| self.slide_at(position))
            .and_then(|slide| slide.transition.clone())
            .unwrap_or_else(|| self.policy.clone());
        self.transition = Some(self.describe(&transition));
    }

    fn describe(&self, transition: &Transition) -> TransitionState {
        TransitionState {
            revision: self.revision,
            kind: transition.kind,
            duration_ms: transition.duration_ms,
            easing: transition.easing.clone(),
        }
    }

    /// The state every output should show right now.
    pub fn state(&self) -> RenderState {
        let Some((show, _group, slide)) = self.current() else {
            return RenderState::blank(self.revision);
        };

        let root = self.media_root.as_deref();
        let playing = !self.cleared;
        let next = self
            .order
            .get(self.index + 1)
            .and_then(|position| self.slide_at(*position))
            .map(|slide| project_slide(slide, root, playing));

        if self.cleared {
            // A cleared output still reports which slide is live, so a remote
            // or stage client can show "blanked at verse 3" rather than nothing.
            return RenderState {
                revision: self.revision,
                show_id: show.id.clone(),
                slide_id: slide.id.clone(),
                notes: slide.notes.clone(),
                slide: RenderSlide::default(),
                next,
                transition: self.transition.clone(),
            };
        }

        RenderState {
            revision: self.revision,
            show_id: show.id.clone(),
            slide_id: slide.id.clone(),
            slide: project_slide(slide, root, playing),
            notes: slide.notes.clone(),
            next,
            transition: self.transition.clone(),
        }
    }
}

/// Projection from domain to render model — the one place rendering rules live.
fn project_slide(slide: &Slide, root: Option<&Path>, playing: bool) -> RenderSlide {
    RenderSlide {
        background: None,
        elements: slide
            .elements
            .iter()
            .map(|element| RenderElement {
                id: element.id.clone(),
                class_name: element.class_name.clone(),
                text: element.text.clone(),
                style: element.style.clone(),
                media: element
                    .media
                    .as_ref()
                    .map(|media| project_media(media, root, playing)),
            })
            .collect(),
    }
}

fn project_media(media: &MediaRef, root: Option<&Path>, playing: bool) -> RenderMedia {
    let path = Path::new(&media.path);
    let resolved = if path.is_absolute() {
        path.to_path_buf()
    } else {
        match root {
            Some(root) => root.join(path),
            // No root yet: keep the path, the renderer will fail visibly rather
            // than silently playing whatever a relative lookup finds.
            None => path.to_path_buf(),
        }
    };

    RenderMedia {
        kind: media.kind,
        src: crate::media::file_url(&resolved),
        looped: media.looped,
        muted: media.muted,
        playing,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{SlideElement, TransitionKind};

    fn slide(id: &str, text: &str) -> Slide {
        Slide {
            id: id.into(),
            name: id.into(),
            elements: vec![SlideElement {
                id: format!("{id}-text"),
                text: text.into(),
                class_name: "lyrics".into(),
                style: String::new(),
                ..Default::default()
            }],
            ..Default::default()
        }
    }

    /// Two shows, five slides total, one group deliberately empty.
    fn fixture() -> Project {
        fn group(id: &str, name: &str, slides: Vec<Slide>) -> SlideGroup {
            SlideGroup {
                id: id.into(),
                name: name.into(),
                slides,
                ..Default::default()
            }
        }
        fn show(id: &str, name: &str, groups: Vec<SlideGroup>) -> Show {
            Show {
                id: id.into(),
                name: name.into(),
                groups,
                ..Default::default()
            }
        }

        Project {
            id: "p1".into(),
            name: "Sunday".into(),
            shows: vec![
                show(
                    "s1",
                    "Worship",
                    vec![
                        group(
                            "g1",
                            "Song A",
                            vec![slide("a1", "first"), slide("a2", "second")],
                        ),
                        group("g-empty", "Empty", vec![]),
                        group("g2", "Song B", vec![slide("b1", "third")]),
                    ],
                ),
                show(
                    "s2",
                    "Sermon",
                    vec![group(
                        "g3",
                        "Points",
                        vec![slide("c1", "fourth"), slide("c2", "fifth")],
                    )],
                ),
            ],
            ..Default::default()
        }
    }

    #[test]
    fn flattens_slides_in_order_across_groups_and_shows() {
        let engine = ShowEngine::new(fixture());
        assert_eq!(engine.len(), 5);
        assert_eq!(engine.index(), 0);
        assert_eq!(engine.state().slide_id, "a1");
    }

    #[test]
    fn next_advances_and_increments_revision() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.next_slide());
        assert_eq!(engine.revision(), 1);
        assert_eq!(engine.state().slide_id, "a2");

        // Crosses the empty group without stalling.
        assert!(engine.next_slide());
        assert_eq!(engine.state().slide_id, "b1");

        // Crosses into the next show.
        assert!(engine.next_slide());
        assert_eq!(engine.state().slide_id, "c1");
    }

    #[test]
    fn next_at_the_end_is_a_no_op() {
        let mut engine = ShowEngine::new(fixture());
        while engine.next_slide() {}
        let revision = engine.revision();
        assert_eq!(engine.state().slide_id, "c2");
        assert!(!engine.next_slide());
        assert_eq!(engine.revision(), revision);
    }

    #[test]
    fn previous_at_the_start_is_a_no_op() {
        let mut engine = ShowEngine::new(fixture());
        assert!(!engine.previous_slide());
        assert_eq!(engine.revision(), 0);
        assert_eq!(engine.state().slide_id, "a1");
    }

    #[test]
    fn previous_walks_back_across_boundaries() {
        let mut engine = ShowEngine::new(fixture());
        engine.next_slide();
        engine.next_slide();
        assert_eq!(engine.state().slide_id, "b1");
        assert!(engine.previous_slide());
        assert_eq!(engine.state().slide_id, "a2");
    }

    #[test]
    fn go_to_addresses_a_slide_directly() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.go_to(Position {
            show: 1,
            group: 0,
            slide: 1
        }));
        assert_eq!(engine.state().slide_id, "c2");
        assert_eq!(engine.revision(), 1);
    }

    #[test]
    fn go_to_out_of_range_is_a_no_op() {
        let mut engine = ShowEngine::new(fixture());
        assert!(!engine.go_to(Position {
            show: 9,
            group: 0,
            slide: 0
        }));
        assert_eq!(engine.revision(), 0);
    }

    #[test]
    fn navigation_publishes_a_transition_tagged_with_its_revision() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.state().transition.is_none());

        engine.next_slide();
        let state = engine.state();
        let transition = state.transition.expect("transition after navigation");
        assert_eq!(transition.revision, state.revision);
        assert_eq!(transition.kind, TransitionKind::Fade);
        assert_eq!(
            transition.duration_ms, 500,
            "FreeShow's default text timing"
        );
        assert_eq!(transition.easing, "sine", "FreeShow's default curve");
    }

    #[test]
    fn a_slides_own_transition_wins_over_the_default() {
        let mut project = fixture();
        project.shows[0].groups[0].slides[1].transition = Some(Transition {
            kind: TransitionKind::Slide,
            duration_ms: 1200,
            easing: "cubic".to_string(),
            ..Default::default()
        });

        let mut engine = ShowEngine::new(project);
        engine.next_slide();
        let transition = engine.state().transition.expect("a transition");
        assert_eq!(transition.kind, TransitionKind::Slide);
        assert_eq!(transition.duration_ms, 1200);
        assert_eq!(transition.easing, "cubic");
    }

    #[test]
    fn a_slide_without_a_transition_uses_the_project_default() {
        let mut engine = ShowEngine::new(fixture()).with_transition_policy(Transition {
            kind: TransitionKind::None,
            duration_ms: 0,
            easing: "linear".to_string(),
            ..Default::default()
        });
        engine.next_slide();
        let transition = engine.state().transition.expect("a transition");
        assert_eq!(transition.kind, TransitionKind::None);
        assert_eq!(transition.duration_ms, 0);
    }

    #[test]
    fn clearing_uses_the_default_not_the_slides_transition() {
        // A slide transition describes arriving at that slide; blanking is not
        // arriving anywhere, so the project default applies.
        let mut project = fixture();
        project.shows[0].groups[0].slides[0].transition = Some(Transition {
            kind: TransitionKind::Spin,
            duration_ms: 900,
            easing: "back".to_string(),
            ..Default::default()
        });

        let mut engine = ShowEngine::new(project);
        engine.toggle_clear();
        let transition = engine.state().transition.expect("a transition");
        assert_eq!(transition.kind, TransitionKind::Fade);
        assert_eq!(transition.duration_ms, 500);
    }

    #[test]
    fn next_group_lands_on_the_next_sections_first_slide() {
        let mut engine = ShowEngine::new(fixture());
        // fixture: g1 = a1,a2 · g-empty · g2 = b1 · g3 = c1,c2
        assert_eq!(engine.state().slide_id, "a1");

        assert!(engine.next_group());
        assert_eq!(engine.state().slide_id, "b1", "skips the empty group");

        assert!(engine.next_group());
        assert_eq!(engine.state().slide_id, "c1", "crosses into the next show");
    }

    #[test]
    fn previous_group_lands_on_the_previous_sections_first_slide() {
        let mut engine = ShowEngine::new(fixture());
        engine.go_to_index(4); // c2, inside the last group
        assert_eq!(engine.state().slide_id, "c2");

        assert!(engine.previous_group());
        assert_eq!(engine.state().slide_id, "b1");

        assert!(engine.previous_group());
        assert_eq!(engine.state().slide_id, "a1");
        assert!(!engine.previous_group(), "no group before the first");
    }

    #[test]
    fn group_navigation_is_a_no_op_when_there_is_nowhere_to_go() {
        let mut engine = ShowEngine::new(fixture());
        assert!(!engine.previous_group());
        assert_eq!(engine.revision(), 0);

        engine.go_to_index(1); // a2, last slide of the first group
        assert!(engine.next_group());
        assert_eq!(engine.revision(), 2);
    }

    #[test]
    fn state_carries_the_slide_notes() {
        let mut project = fixture();
        project.shows[0].groups[0].slides[0].notes = "Welcome, then verse one".to_string();
        let engine = ShowEngine::new(project);
        assert_eq!(engine.state().notes, "Welcome, then verse one");
    }

    #[test]
    fn state_carries_the_next_slide() {
        let mut engine = ShowEngine::new(fixture());
        let state = engine.state();
        let next = state.next.expect("a next slide exists");
        assert_eq!(next.elements[0].text, "second");

        engine.last_slide_for_test();
        assert!(
            engine.state().next.is_none(),
            "nothing follows the last slide"
        );
    }

    #[test]
    fn clearing_blanks_the_output_but_keeps_the_position() {
        let mut engine = ShowEngine::new(fixture());
        engine.next_slide();
        assert_eq!(engine.state().slide_id, "a2");

        assert!(engine.toggle_clear());
        let cleared = engine.state();
        assert!(cleared.slide.is_blank(), "output should be blank");
        assert_eq!(cleared.slide_id, "a2", "position is still reported");
        assert!(cleared.slide.elements.is_empty());

        assert!(engine.toggle_clear());
        assert_eq!(engine.state().slide_id, "a2");
        assert!(!engine.state().slide.is_blank());
    }

    #[test]
    fn setting_cleared_to_its_current_value_is_a_no_op() {
        let mut engine = ShowEngine::new(fixture());
        assert!(!engine.set_cleared(false));
        assert_eq!(engine.revision(), 0);
        assert!(engine.set_cleared(true));
        assert_eq!(engine.revision(), 1);
        assert!(!engine.set_cleared(true));
        assert_eq!(engine.revision(), 1);
    }

    #[test]
    fn loading_nothing_yields_a_blank_state_not_an_error() {
        let engine = ShowEngine::new(Project::default());
        let state = engine.state();
        assert!(state.slide.is_blank());
        assert_eq!(state.revision, 0);
        assert!(!engine.is_loaded());
    }

    #[test]
    fn navigating_after_clear_restores_the_output() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.apply(Command::Clear));
        assert!(engine.is_cleared());
        assert!(engine.state().slide.is_blank());

        assert!(engine.apply(Command::Next));
        assert!(!engine.is_cleared(), "navigation reveals the slide again");
        assert_eq!(engine.state().slide_id, "a2");
        assert!(!engine.state().slide.is_blank());
    }

    #[test]
    fn clear_blanks_and_restore_reveals_without_moving() {
        let mut engine = ShowEngine::new(fixture());
        engine.next_slide();

        assert!(engine.apply(Command::Clear));
        assert!(engine.is_cleared());
        assert_eq!(engine.state().slide_id, "a2", "position is kept");

        assert!(!engine.apply(Command::Clear), "clearing twice is a no-op");
        assert!(engine.apply(Command::Restore));
        assert!(!engine.is_cleared());
        assert_eq!(engine.state().slide_id, "a2");
        assert!(
            !engine.apply(Command::Restore),
            "restoring twice is a no-op"
        );
    }

    #[test]
    fn first_and_last_are_reachable_as_commands() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.apply(Command::Last));
        assert_eq!(engine.state().slide_id, "c2");
        assert!(engine.apply(Command::First));
        assert_eq!(engine.state().slide_id, "a1");
    }

    #[test]
    fn media_is_resolved_against_the_project_root() {
        use crate::domain::MediaRef;
        use crate::media::{MediaKind, MediaOrigin};

        let mut project = fixture();
        project.shows[0].groups[0].slides[0]
            .elements
            .push(SlideElement {
                id: "bg".into(),
                class_name: "media".into(),
                style: "top:0;left:0;width:100%;height:100%;".into(),
                media: Some(MediaRef {
                    path: "media/clip one.mp4".into(),
                    kind: MediaKind::Video,
                    origin: MediaOrigin::Bundled,
                    looped: false,
                    muted: true,
                }),
                ..Default::default()
            });

        let engine = ShowEngine::new(project).with_media_root("/srv/sunday");
        let slide = engine.state().slide;
        let media = slide.elements[1].media.as_ref().expect("a media element");
        assert_eq!(
            media.src, "file:///srv/sunday/media/clip%20one.mp4",
            "relative paths resolve against the project, spaces are encoded"
        );
        assert_eq!(media.kind, MediaKind::Video);
        assert!(media.playing);
    }

    #[test]
    fn an_absolute_media_path_ignores_the_root_and_clearing_stops_playback() {
        use crate::domain::MediaRef;
        use crate::media::{MediaKind, MediaOrigin};

        let mut project = fixture();
        // Absolute on the host running the test, so this works on Windows too.
        let absolute = std::env::temp_dir().join("cjcp-logo.png");
        for slide in project.shows[0].groups[0].slides.iter_mut() {
            slide.elements.push(SlideElement {
                id: format!("{}-bg", slide.id),
                class_name: "media".into(),
                style: String::new(),
                media: Some(MediaRef {
                    path: absolute.to_string_lossy().to_string(),
                    kind: MediaKind::Image,
                    origin: MediaOrigin::External,
                    looped: false,
                    muted: true,
                }),
                ..Default::default()
            });
        }

        let mut engine =
            ShowEngine::new(project).with_media_root(std::env::temp_dir().join("ignored-root"));
        let media = engine.state().slide.elements[1]
            .media
            .clone()
            .expect("a media element");
        assert_eq!(
            media.src,
            crate::media::file_url(&absolute),
            "an absolute path is not joined to the root"
        );

        engine.toggle_clear();
        let next = engine.state().next.expect("a next slide");
        assert!(
            !next.elements[1].media.as_ref().unwrap().playing,
            "a blanked output does not start media"
        );
    }

    #[test]
    fn replacing_the_project_resets_position_without_animating() {
        let mut engine = ShowEngine::new(fixture());
        engine.next_slide();
        engine.go_to_index(3);
        engine.toggle_clear();
        let before = engine.revision();

        let mut other = fixture();
        other.shows.truncate(1);
        assert!(engine.replace_project(other));

        let state = engine.state();
        assert_eq!(engine.index(), 0);
        assert!(!engine.is_cleared());
        assert_eq!(state.slide_id, "a1");
        assert!(
            state.transition.is_none(),
            "opening a project must not replay a transition"
        );
        assert_eq!(engine.revision(), before + 1, "outputs must re-render");
        assert_eq!(engine.len(), 3, "the new project's slide count");
    }

    #[test]
    fn replacing_with_an_empty_project_blanks_the_output() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.is_loaded());
        assert!(!engine.replace_project(Project::default()));
        assert!(!engine.is_loaded());
        assert_eq!(engine.revision(), 1);
        assert!(engine.state().slide.is_blank());
    }

    #[test]
    fn state_is_self_sufficient_for_a_fresh_renderer() {
        let mut engine = ShowEngine::new(fixture());
        engine.next_slide();
        engine.next_slide();

        // A window that has never rendered anything gets exactly the live slide,
        // with no history and no lookups against the project.
        let state = engine.state();
        assert_eq!(state.slide.elements.len(), 1);
        assert_eq!(state.slide.elements[0].text, "third");
        assert_eq!(state.slide.elements[0].class_name, "lyrics");
    }
}
