//! Navigation over a loaded project.
//!
//! Pure state: no IO, no windows, no timers, no media. Every method here must be
//! reachable from `cargo test` without a display server.

use tracing::debug;

use crate::domain::{Project, Show, Slide, SlideGroup};
use crate::render::{
    RenderElement, RenderSlide, RenderState, Revision, TransitionKind, TransitionState,
};

/// A slide's address inside the project.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Position {
    pub show: usize,
    pub group: usize,
    pub slide: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransitionPolicy {
    pub kind: TransitionKind,
    pub duration_ms: u32,
}

impl Default for TransitionPolicy {
    fn default() -> Self {
        Self {
            kind: TransitionKind::Fade,
            duration_ms: 400,
        }
    }
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
    policy: TransitionPolicy,
    transition: Option<TransitionState>,
}

impl ShowEngine {
    pub fn new(project: Project) -> Self {
        let order = Self::build_order(&project);
        Self {
            project,
            order,
            index: 0,
            revision: 0,
            policy: TransitionPolicy::default(),
            transition: None,
        }
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

    pub fn with_transition_policy(mut self, policy: TransitionPolicy) -> Self {
        self.policy = policy;
        self
    }

    pub fn project(&self) -> &Project {
        &self.project
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

    fn bump(&mut self) {
        self.revision += 1;
        self.transition = Some(TransitionState {
            revision: self.revision,
            kind: self.policy.kind,
            duration_ms: self.policy.duration_ms,
        });
    }

    /// The state every output should show right now.
    pub fn state(&self) -> RenderState {
        let Some((show, _group, slide)) = self.current() else {
            return RenderState::blank(self.revision);
        };

        RenderState {
            revision: self.revision,
            show_id: show.id.clone(),
            slide_id: slide.id.clone(),
            slide: project_slide(slide),
            transition: self.transition,
        }
    }
}

/// Projection from domain to render model — the one place rendering rules live.
fn project_slide(slide: &Slide) -> RenderSlide {
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
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::SlideElement;

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
