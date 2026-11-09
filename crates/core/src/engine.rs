//! Navigation over a loaded project.
//!
//! Pure state: no IO, no windows, no timers, no media. Every method here must be
//! reachable from `cargo test` without a display server.

use tracing::debug;

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::clock::{Clock, SystemClock};
use crate::domain::{MediaRef, Project, ProjectEntry, Show, Slide, SlideGroup, Transition};
use crate::input::Command;
use crate::render::{
    RenderElement, RenderMedia, RenderSlide, RenderState, Revision, StageLayout, StageTimer,
    TransitionState,
};

/// A slide's address inside the project.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Position {
    pub show: usize,
    pub group: usize,
    pub slide: usize,
}

/// Where the live slide's media is in its own timeline.
///
/// One timeline is enough: only one slide is live, and its media shares one
/// clock. Pausing stores the elapsed position so restoring resumes rather than
/// restarts.
#[derive(Debug, Clone, Default)]
struct MediaTimeline {
    offset_ms: u64,
    /// Clock reading when playback last started; `None` while paused.
    started_ms: Option<u64>,
}

impl MediaTimeline {
    fn restart(&mut self, now_ms: u64, from_ms: u64) {
        self.offset_ms = from_ms;
        self.started_ms = Some(now_ms);
    }

    fn pause(&mut self, now_ms: u64) {
        if let Some(started) = self.started_ms.take() {
            self.offset_ms += now_ms.saturating_sub(started);
        }
    }

    fn resume(&mut self, now_ms: u64) {
        if self.started_ms.is_none() {
            self.started_ms = Some(now_ms);
        }
    }

    fn position(&self, now_ms: u64) -> u64 {
        self.offset_ms
            + self
                .started_ms
                .map(|started| now_ms.saturating_sub(started))
                .unwrap_or(0)
    }
}

/// A stage countdown. Time comes from the same injected clock as media, so tests
/// can advance it without sleeping.
#[derive(Debug, Clone)]
struct Countdown {
    total_ms: u64,
    remaining_at_start_ms: u64,
    started_ms: Option<u64>,
}

impl Countdown {
    fn remaining(&self, now_ms: u64) -> u64 {
        match self.started_ms {
            Some(started) => self
                .remaining_at_start_ms
                .saturating_sub(now_ms.saturating_sub(started)),
            None => self.remaining_at_start_ms,
        }
    }

    fn start(&mut self, now_ms: u64) {
        if self.started_ms.is_none() && self.remaining_at_start_ms > 0 {
            self.started_ms = Some(now_ms);
        }
    }

    fn pause(&mut self, now_ms: u64) {
        if let Some(started) = self.started_ms.take() {
            self.remaining_at_start_ms = self
                .remaining_at_start_ms
                .saturating_sub(now_ms.saturating_sub(started));
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
    /// Which section each show belongs to, parallel to `project.shows`.
    /// Sections are project markers that group shows; they have no slides.
    sections: Vec<usize>,
    /// The slide the audience sees.
    index: usize,
    /// The project show the operator has moved to. It differs from the live
    /// show only while a press at the end of a show has selected the next item
    /// without playing it yet.
    selected_show: usize,
    /// FreeShow's `special.nextItemOnLastSlide`. On, a press at the last slide
    /// of a show selects the next presentable show; off, it does nothing.
    next_item_on_last_slide: bool,
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
    /// When set, media is served over loopback HTTP at this base instead of
    /// `file://`. A WebView page loaded from a custom scheme cannot read
    /// `file://` subresources; the app uses this, the render harness does not.
    media_base: Option<String>,
    /// Where the live slide's media is. Advanced by reading the clock, never by
    /// a timer thread: the state is computed when someone asks for it.
    timeline: MediaTimeline,
    /// An operator message for the stage. Not persisted: it is for the people
    /// in the room now.
    message: Option<String>,
    timer: Option<Countdown>,
    stage_layout: StageLayout,
    clock: Arc<dyn Clock>,
}

impl ShowEngine {
    pub fn new(project: Project) -> Self {
        let order = Self::build_order(&project);
        let sections = Self::build_sections(&project);
        let selected_show = order.first().map(|position| position.show).unwrap_or(0);
        Self {
            project,
            order,
            sections,
            index: 0,
            selected_show,
            next_item_on_last_slide: true,
            revision: 0,
            policy: Transition::default(),
            transition: None,
            cleared: false,
            media_root: None,
            media_base: None,
            // The first slide is live from construction; its media starts now.
            timeline: MediaTimeline {
                offset_ms: 0,
                started_ms: Some(0),
            },
            message: None,
            timer: None,
            stage_layout: StageLayout::default(),
            clock: Arc::new(SystemClock::new()),
        }
    }

    /// Replace the clock. Tests use a manual one; production uses the system
    /// monotonic clock. Restarts the timeline at the new clock's origin so the
    /// first slide's media begins at zero.
    pub fn with_clock(mut self, clock: Arc<dyn Clock>) -> Self {
        self.timeline.restart(clock.now_ms(), 0);
        self.clock = clock;
        self
    }

    /// Jump the live slide's media to `position_ms`, as a coordinator or an
    /// operator scrubbing would. Not a slide change: no transition is emitted.
    pub fn seek_media(&mut self, position_ms: u64) -> bool {
        let now = self.clock.now_ms();
        self.timeline.restart(now, position_ms);
        self.revision += 1;
        true
    }

    pub fn media_position_ms(&self) -> u64 {
        self.timeline.position(self.clock.now_ms())
    }

    /// Set or clear the operator message shown on the stage.
    pub fn set_message(&mut self, message: Option<&str>) -> bool {
        let message = message
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_string);
        if self.message == message {
            return false;
        }
        self.message = message;
        self.revision += 1;
        true
    }

    pub fn message(&self) -> Option<&str> {
        self.message.as_deref()
    }

    /// Change how stage displays arrange their panes.
    pub fn set_stage_layout(&mut self, layout: StageLayout) -> bool {
        if self.stage_layout == layout {
            return false;
        }
        self.stage_layout = layout;
        self.revision += 1;
        true
    }

    /// Set the countdown to `seconds`, paused at the start.
    pub fn set_timer(&mut self, seconds: u64) -> bool {
        let total_ms = seconds.saturating_mul(1000);
        if total_ms == 0 {
            return self.clear_timer();
        }
        self.timer = Some(Countdown {
            total_ms,
            remaining_at_start_ms: total_ms,
            started_ms: None,
        });
        self.revision += 1;
        true
    }

    pub fn start_timer(&mut self) -> bool {
        let now = self.clock.now_ms();
        let Some(timer) = self.timer.as_mut() else {
            return false;
        };
        if timer.started_ms.is_some() || timer.remaining_at_start_ms == 0 {
            return false;
        }
        timer.start(now);
        self.revision += 1;
        true
    }

    pub fn pause_timer(&mut self) -> bool {
        let now = self.clock.now_ms();
        let Some(timer) = self.timer.as_mut() else {
            return false;
        };
        if timer.started_ms.is_none() {
            return false;
        }
        timer.pause(now);
        self.revision += 1;
        true
    }

    /// Put the countdown back to its full duration, paused.
    pub fn reset_timer(&mut self) -> bool {
        let Some(timer) = self.timer.as_mut() else {
            return false;
        };
        timer.remaining_at_start_ms = timer.total_ms;
        timer.started_ms = None;
        self.revision += 1;
        true
    }

    pub fn clear_timer(&mut self) -> bool {
        if self.timer.take().is_none() {
            return false;
        }
        self.revision += 1;
        true
    }

    fn stage_timer(&self, now_ms: u64) -> Option<StageTimer> {
        self.timer.as_ref().map(|timer| StageTimer {
            remaining_ms: timer.remaining(now_ms),
            running: timer.started_ms.is_some() && timer.remaining(now_ms) > 0,
        })
    }

    /// Where this project's bundled media lives.
    pub fn with_media_root(mut self, root: impl Into<PathBuf>) -> Self {
        self.media_root = Some(root.into());
        self
    }

    pub fn media_root(&self) -> Option<&Path> {
        self.media_root.as_deref()
    }

    /// Serve media from `base` (`http://127.0.0.1:PORT`) instead of `file://`.
    pub fn with_media_base(mut self, base: impl Into<String>) -> Self {
        self.media_base = Some(base.into());
        self
    }

    /// Assign each show a section group from the project's ordered entries.
    fn build_sections(project: &Project) -> Vec<usize> {
        let mut groups = vec![0usize; project.shows.len()];
        let mut current = 0usize;
        for entry in &project.entries {
            match entry {
                ProjectEntry::Section { .. } => current += 1,
                ProjectEntry::Show { id } | ProjectEntry::Other { id, .. } => {
                    if let Some(index) = project.shows.iter().position(|show| &show.id == id) {
                        groups[index] = current;
                    }
                }
            }
        }
        groups
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
        let now = self.clock.now_ms();
        self.timeline.restart(now, 0);
        self.order = Self::build_order(&project);
        self.sections = Self::build_sections(&project);
        self.project = project;
        self.index = 0;
        self.selected_show = self
            .order
            .first()
            .map(|position| position.show)
            .unwrap_or(0);
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

    /// The project index of the selected show, or `None` when there is no show
    /// with a slide to select.
    pub fn selected_show(&self) -> Option<usize> {
        if self.order.is_empty() {
            return None;
        }
        Some(self.selected_show)
    }

    /// FreeShow's `special.nextItemOnLastSlide`, on by default.
    pub fn next_item_on_last_slide(&self) -> bool {
        self.next_item_on_last_slide
    }

    /// Change the end-of-show setting. Returns whether the value changed.
    ///
    /// This is a preference, not navigation: the live slide, the selection and
    /// the revision are untouched. The controller is what repaints.
    pub fn set_next_item_on_last_slide(&mut self, enabled: bool) -> bool {
        if self.next_item_on_last_slide == enabled {
            return false;
        }
        self.next_item_on_last_slide = enabled;
        true
    }

    /// Advance one slide. Returns whether anything changed.
    ///
    /// Inside a show this moves the output one slide. At a show's last slide,
    /// FreeShow moves in two steps: the first press selects the next show that
    /// has a slide, leaving the output where it is; the following press outputs
    /// that show's first slide. The setting can stop the move, and at the end
    /// of the project there is nowhere to go.
    pub fn next_slide(&mut self) -> bool {
        let Some(current) = self.position() else {
            debug!("next on a project with no slides; ignoring");
            return false;
        };
        let Some(next) = self.order.get(self.index + 1).copied() else {
            debug!("next at final slide; ignoring");
            return false;
        };

        if next.show == current.show {
            self.index += 1;
            self.bump();
            return true;
        }

        if !self.next_item_on_last_slide {
            debug!("next past a show's last slide, setting off; ignoring");
            return false;
        }

        if self.selected_show == next.show {
            // The selection already landed on the next show: play it.
            return self.go_to_index(self.index + 1);
        }

        // First press: select the next show and leave the output alone.
        self.select_show(next.show)
    }

    /// Move the selection without touching the output.
    ///
    /// The revision moves so the controller repaints, but no transition
    /// accompanies it: the audience sees the same slide as before.
    fn select_show(&mut self, show: usize) -> bool {
        if self.selected_show == show {
            return false;
        }
        self.selected_show = show;
        self.transition = None;
        self.revision += 1;
        true
    }

    /// Go back one slide. Returns whether anything changed.
    pub fn previous_slide(&mut self) -> bool {
        if self.index == 0 {
            debug!("previous at first slide; ignoring");
            return false;
        }
        self.go_to_index(self.index - 1)
    }

    /// Jump to the first slide of the next section.
    ///
    /// A section groups the shows that follow it, so the target is the first
    /// slide of the first show in the next group. A project without sections
    /// has one group, so this is a no-op.
    pub fn next_section(&mut self) -> bool {
        let Some(current) = self.position() else {
            return false;
        };
        let Some(group) = self.sections.get(current.show).copied() else {
            return false;
        };
        self.jump_to_section(group + 1)
    }

    /// Jump to the first slide of the previous section.
    pub fn previous_section(&mut self) -> bool {
        let Some(current) = self.position() else {
            return false;
        };
        let Some(group) = self.sections.get(current.show).copied() else {
            return false;
        };
        if group == 0 {
            return false;
        }
        self.jump_to_section(group - 1)
    }

    fn jump_to_section(&mut self, group: usize) -> bool {
        let Some(show) = self
            .sections
            .iter()
            .position(|candidate| *candidate == group)
        else {
            return false;
        };
        let Some(index) = self.order.iter().position(|position| position.show == show) else {
            return false;
        };
        self.go_to_index(index)
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

    /// Jump to the first slide of a show by project index.
    pub fn go_to_show(&mut self, show: usize) -> bool {
        let Some(index) = self.order.iter().position(|position| position.show == show) else {
            return false;
        };
        self.go_to_index(index)
    }

    /// The project index of the live show.
    pub fn current_show(&self) -> Option<usize> {
        self.position().map(|position| position.show)
    }

    pub fn go_to_index(&mut self, index: usize) -> bool {
        if index >= self.order.len() {
            return false;
        }
        let show = self.order[index].show;
        if index == self.index {
            // Landing on the slide already live still re-targets the selection:
            // an operator who clicks the live show after a next-at-the-end press
            // must see it selected again. The output is unchanged.
            return self.select_show(show);
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
    /// than the transition the incoming slide declares. It also pauses media:
    /// the congregation sees black, so the clip must not run on unseen.
    pub fn set_cleared(&mut self, cleared: bool) -> bool {
        if self.cleared == cleared {
            return false;
        }
        self.cleared = cleared;
        self.revision += 1;

        let now = self.clock.now_ms();
        if cleared {
            self.timeline.pause(now);
        } else {
            self.timeline.resume(now);
        }

        let policy = self.policy.clone();
        self.transition = Some(self.describe(&policy));
        true
    }

    pub fn toggle_clear(&mut self) -> bool {
        self.set_cleared(!self.cleared)
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
            Command::NextSection => self.next_section(),
            Command::PreviousSection => self.previous_section(),
            Command::First => self.go_to_index(0),
            Command::Last => self.go_to_index(self.order.len().saturating_sub(1)),
            Command::Clear => self.set_cleared(true),
            Command::Restore => self.set_cleared(false),
        }
    }

    fn bump(&mut self) {
        // A landed slide is also the selected show. The two positions differ
        // only between the two presses of a next-at-the-end move.
        if let Some(position) = self.position() {
            self.selected_show = position.show;
        }
        // Navigating reveals the output again. In FreeShow the cleared state is
        // derived from whether an output has content, so any slide change
        // restores it; leaving it blank would make Escape a trap.
        self.cleared = false;
        self.revision += 1;
        // The incoming slide's media starts at zero.
        let now = self.clock.now_ms();
        self.timeline.restart(now, 0);
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
            direction: transition.direction(),
            easing: transition.easing.clone(),
        }
    }

    /// The state every output should show right now.
    pub fn state(&self) -> RenderState {
        let Some((show, _group, slide)) = self.current() else {
            return RenderState::blank(self.revision);
        };

        let root = self.media_root.as_deref();
        let base = self.media_base.as_deref();
        let playing = !self.cleared;
        let now_ms = self.clock.now_ms();
        let position_ms = self.timeline.position(now_ms);
        let timer = self.stage_timer(now_ms);
        let next = self
            .order
            .get(self.index + 1)
            .and_then(|position| self.slide_at(*position))
            .map(|slide| project_slide(slide, root, base, playing, 0));

        if self.cleared {
            // A cleared output still reports which slide is live, so a remote
            // or stage client can show "blanked at verse 3" rather than nothing.
            return RenderState {
                revision: self.revision,
                show_id: show.id.clone(),
                slide_id: slide.id.clone(),
                notes: slide.notes.clone(),
                slide: RenderSlide::default(),
                message: self.message.clone(),
                timer,
                stage_layout: self.stage_layout,
                next,
                transition: self.transition.clone(),
            };
        }

        RenderState {
            revision: self.revision,
            show_id: show.id.clone(),
            slide_id: slide.id.clone(),
            slide: project_slide(slide, root, base, playing, position_ms),
            notes: slide.notes.clone(),
            message: self.message.clone(),
            timer,
            stage_layout: self.stage_layout,
            next,
            transition: self.transition.clone(),
        }
    }
}

/// Projection from domain to render model — the one place rendering rules live.
fn project_slide(
    slide: &Slide,
    root: Option<&Path>,
    base: Option<&str>,
    playing: bool,
    position_ms: u64,
) -> RenderSlide {
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
                    .map(|media| project_media(media, root, base, playing, position_ms)),
            })
            .collect(),
    }
}

fn project_media(
    media: &MediaRef,
    root: Option<&Path>,
    base: Option<&str>,
    playing: bool,
    position_ms: u64,
) -> RenderMedia {
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

    let src = match base {
        Some(base) => format!(
            "{base}/media/{}",
            crate::media::url_path_component(&resolved)
        ),
        None => crate::media::file_url(&resolved),
    };

    RenderMedia {
        kind: media.kind,
        fit: media.fit,
        src,
        looped: media.looped,
        muted: media.muted,
        playing,
        position_ms,
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

        // The last slide of the show: the next press only selects the next
        // show, because FreeShow moves to the next item in two presses.
        assert!(engine.next_slide());
        assert_eq!(engine.state().slide_id, "b1");
        assert_eq!(engine.selected_show(), Some(1));
        assert_eq!(engine.revision(), 3);

        // The following press crosses into the next show.
        assert!(engine.next_slide());
        assert_eq!(engine.state().slide_id, "c1");
        assert_eq!(engine.revision(), 4);
    }

    #[test]
    fn next_at_the_end_is_a_no_op() {
        let mut engine = ShowEngine::new(fixture());
        // Walk to the end, including the selection-only press at the first
        // show's last slide. The loop stops because nothing follows the last
        // show.
        while engine.next_slide() {}
        let revision = engine.revision();
        assert_eq!(engine.state().slide_id, "c2");
        assert!(!engine.next_slide());
        assert_eq!(engine.revision(), revision);
        assert_eq!(
            engine.selected_show(),
            Some(1),
            "the live show stays selected at the end of the project"
        );
    }

    #[test]
    fn next_at_show_end_selects_then_plays() {
        let mut engine = ShowEngine::new(fixture());
        // b1, the last slide of the first show.
        assert!(engine.go_to_index(2));
        let before = engine.revision();

        assert!(
            engine.next_slide(),
            "the first press is a state change: the selection moved"
        );
        assert_eq!(engine.state().slide_id, "b1", "the output has not moved");
        assert_eq!(engine.selected_show(), Some(1));
        assert_eq!(engine.revision(), before + 1);
        assert!(
            engine.state().transition.is_none(),
            "a selection change is not a slide change and starts no transition"
        );

        assert!(engine.next_slide(), "the second press plays the selection");
        assert_eq!(engine.state().slide_id, "c1");
        assert_eq!(
            engine.selected_show(),
            Some(1),
            "selected and live agree again once the slide lands"
        );
        assert_eq!(engine.revision(), before + 2);
        assert!(
            engine.state().transition.is_some(),
            "playing is an ordinary advance and publishes a transition"
        );
    }

    #[test]
    fn next_at_show_end_setting_off_is_no_op() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.set_next_item_on_last_slide(false));
        assert!(engine.go_to_index(2));
        let before = engine.revision();

        assert!(!engine.next_slide(), "the setting stops the move");
        assert_eq!(engine.state().slide_id, "b1");
        assert_eq!(
            engine.selected_show(),
            Some(0),
            "no selection change either"
        );
        assert_eq!(engine.revision(), before);
    }

    #[test]
    fn next_at_project_end_is_no_op() {
        let mut engine = ShowEngine::new(fixture());
        // c2, the project's last slide.
        assert!(engine.go_to_index(4));
        let before = engine.revision();

        assert!(!engine.next_slide(), "there is no next show to select");
        assert_eq!(engine.state().slide_id, "c2");
        assert_eq!(engine.selected_show(), Some(1));
        assert_eq!(engine.revision(), before, "it does not wrap");
    }

    #[test]
    fn next_within_show_is_unchanged() {
        let mut engine = ShowEngine::new(fixture());
        let before = engine.revision();

        assert!(engine.next_slide(), "inside a show, one press advances");
        assert_eq!(engine.state().slide_id, "a2");
        assert_eq!(engine.revision(), before + 1);

        assert!(engine.next_slide(), "the empty group does not stall it");
        assert_eq!(engine.state().slide_id, "b1");
        assert_eq!(
            engine.selected_show(),
            Some(0),
            "the selection follows the live slide"
        );
    }

    #[test]
    fn selection_follows_go_to_and_first_last() {
        use crate::shared::SharedEngine;

        let shared = SharedEngine::new(ShowEngine::new(fixture()));
        assert!(shared.go_to_show(1));
        assert_eq!(
            shared.selected_show(),
            Some(1),
            "go_to_show selects its show"
        );

        assert!(shared.first_slide());
        assert_eq!(
            shared.selected_show(),
            Some(0),
            "First selects the first show"
        );

        assert!(shared.last_slide());
        assert_eq!(
            shared.selected_show(),
            Some(1),
            "Last selects the last show"
        );

        let mut engine = ShowEngine::new(fixture());
        assert!(engine.go_to(Position {
            show: 1,
            group: 0,
            slide: 1
        }));
        assert_eq!(engine.selected_show(), Some(1), "go_to selects its show");
    }

    #[test]
    fn replace_project_resets_selection() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.go_to_index(2));
        assert!(engine.next_slide());
        assert_eq!(engine.selected_show(), Some(1));

        let mut other = fixture();
        other.shows.truncate(1);
        assert!(engine.replace_project(other));

        assert_eq!(engine.state().slide_id, "a1");
        assert_eq!(engine.current_show(), Some(0));
        assert_eq!(
            engine.selected_show(),
            Some(0),
            "a new project starts with both positions on its first show"
        );
    }

    #[test]
    fn changing_the_end_of_show_setting_does_not_move_anything() {
        let mut engine = ShowEngine::new(fixture());
        assert!(engine.go_to_index(2));
        assert!(engine.next_slide());
        let revision = engine.revision();

        assert!(engine.set_next_item_on_last_slide(false));
        assert!(!engine.set_next_item_on_last_slide(false), "unchanged");
        assert_eq!(
            engine.revision(),
            revision,
            "a preference is not navigation"
        );
        assert_eq!(engine.state().slide_id, "b1");
        assert_eq!(engine.selected_show(), Some(1), "the selection is kept");
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
    fn a_slides_transition_direction_reaches_the_state() {
        let mut project = fixture();
        project.shows[0].groups[0].slides[1].transition = Some(Transition {
            kind: TransitionKind::Slide,
            duration_ms: 800,
            easing: "sine".to_string(),
            extra: [(
                "custom".to_string(),
                serde_json::json!({"direction": "bottom_top"}),
            )]
            .into_iter()
            .collect(),
        });

        let mut engine = ShowEngine::new(project);
        engine.next_slide();
        assert_eq!(
            engine.state().transition.unwrap().direction,
            crate::domain::SlideDirection::BottomTop
        );
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
        assert_eq!(engine.selected_show(), None, "nothing to select");
    }

    #[test]
    fn selection_starts_on_the_first_show_with_a_slide() {
        let mut project = fixture();
        project.shows[0].groups.clear();
        let engine = ShowEngine::new(project);
        assert_eq!(engine.current_show(), Some(1), "the empty show is skipped");
        assert_eq!(
            engine.selected_show(),
            Some(1),
            "selected starts where the output does, on the first presentable show"
        );
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

    fn sectioned_project() -> Project {
        let mut project = fixture();
        project.entries = vec![
            ProjectEntry::Section {
                id: "sec-a".into(),
                name: "Opening".into(),
            },
            ProjectEntry::Show { id: "s1".into() },
            ProjectEntry::Section {
                id: "sec-b".into(),
                name: "Sermon".into(),
            },
            ProjectEntry::Show { id: "s2".into() },
        ];
        project
    }

    #[test]
    fn next_and_previous_section_jump_between_show_groups() {
        let mut engine = ShowEngine::new(sectioned_project());

        // s1 has three slides; the section jump goes to s2's first slide.
        assert!(engine.next_section());
        assert_eq!(engine.state().slide_id, "c1");
        assert!(!engine.next_section(), "no section after the last");

        assert!(engine.previous_section());
        assert_eq!(engine.state().slide_id, "a1");
        assert!(!engine.previous_section(), "no section before the first");
    }

    #[test]
    fn a_project_without_sections_has_one_group() {
        let mut engine = ShowEngine::new(fixture());
        assert!(!engine.next_section());
        assert!(!engine.previous_section());
        assert_eq!(engine.revision(), 0);
    }

    #[test]
    fn a_show_can_be_started_by_index() {
        let mut engine = ShowEngine::new(fixture());
        assert_eq!(engine.current_show(), Some(0));

        assert!(engine.go_to_show(1));
        assert_eq!(engine.state().slide_id, "c1");
        assert_eq!(engine.current_show(), Some(1));

        assert!(!engine.go_to_show(9));
        assert_eq!(
            engine.state().slide_id,
            "c1",
            "an unknown show changes nothing"
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

    fn media_project() -> Project {
        use crate::domain::MediaRef;
        use crate::media::{MediaKind, MediaOrigin};

        let mut project = fixture();
        for slide in project.shows[0].groups[0].slides.iter_mut() {
            slide.elements.push(SlideElement {
                id: format!("{}-clip", slide.id),
                class_name: "media".into(),
                media: Some(MediaRef {
                    path: "/srv/media/clip.webm".into(),
                    kind: MediaKind::Video,
                    origin: MediaOrigin::External,
                    looped: true,
                    muted: true,
                    fit: crate::domain::MediaFit::Cover,
                }),
                ..Default::default()
            });
        }
        project
    }

    #[test]
    fn the_stage_layout_publishes_and_ignores_a_repeat() {
        let mut engine = ShowEngine::new(fixture());
        assert_eq!(engine.state().stage_layout, StageLayout::Split);

        let before = engine.revision();
        assert!(engine.set_stage_layout(StageLayout::LiveOnly));
        assert_eq!(engine.state().stage_layout, StageLayout::LiveOnly);
        assert_eq!(engine.revision(), before + 1);

        assert!(!engine.set_stage_layout(StageLayout::LiveOnly));
        assert_eq!(engine.revision(), before + 1);
    }

    #[test]
    fn an_operator_message_publishes_and_empties_to_nothing() {
        let mut engine = ShowEngine::new(fixture());
        let before = engine.revision();

        assert!(engine.set_message(Some("  Two minutes  ")));
        assert_eq!(engine.message(), Some("Two minutes"));
        assert_eq!(engine.state().message.as_deref(), Some("Two minutes"));
        assert_eq!(engine.revision(), before + 1);

        assert!(!engine.set_message(Some("Two minutes")), "unchanged");
        assert!(engine.set_message(Some("   ")), "blank clears");
        assert_eq!(engine.state().message, None);
    }

    #[test]
    fn a_countdown_starts_pauses_resets_and_expires() {
        let clock = crate::clock::ManualClock::new();
        let mut engine = ShowEngine::new(fixture()).with_clock(Arc::new(clock.clone()));

        assert!(engine.set_timer(120));
        let timer = engine.state().timer.expect("a timer");
        assert_eq!(timer.remaining_ms, 120_000);
        assert!(!timer.running);

        assert!(engine.start_timer());
        clock.advance(30_000);
        let timer = engine.state().timer.expect("a timer");
        assert_eq!(timer.remaining_ms, 90_000);
        assert!(timer.running);

        assert!(engine.pause_timer());
        clock.advance(10_000);
        let timer = engine.state().timer.expect("a timer");
        assert_eq!(
            timer.remaining_ms, 90_000,
            "a paused countdown does not run"
        );
        assert!(!timer.running);

        assert!(engine.reset_timer());
        assert_eq!(engine.state().timer.unwrap().remaining_ms, 120_000);

        // Run past zero: it stops rather than going negative.
        engine.start_timer();
        clock.advance(200_000);
        let timer = engine.state().timer.expect("a timer");
        assert_eq!(timer.remaining_ms, 0);
        assert!(!timer.running);
        assert!(
            !engine.start_timer(),
            "an expired countdown does not restart"
        );

        assert!(engine.clear_timer());
        assert!(engine.state().timer.is_none());
        assert!(!engine.clear_timer());
    }

    #[test]
    fn media_position_advances_with_the_clock_and_freezes_when_cleared() {
        let clock = crate::clock::ManualClock::new();
        let mut engine = ShowEngine::new(media_project()).with_clock(Arc::new(clock.clone()));

        assert_eq!(
            engine.state().slide.elements[1]
                .media
                .as_ref()
                .unwrap()
                .position_ms,
            0
        );

        clock.advance(1500);
        assert_eq!(engine.media_position_ms(), 1500);
        assert_eq!(
            engine.state().slide.elements[1]
                .media
                .as_ref()
                .unwrap()
                .position_ms,
            1500
        );

        engine.set_cleared(true);
        clock.advance(1000);
        assert_eq!(engine.media_position_ms(), 1500, "a blanked output pauses");
        assert!(
            !engine.state().next.as_ref().unwrap().elements[1]
                .media
                .as_ref()
                .unwrap()
                .playing,
            "next is reported but not started"
        );

        engine.set_cleared(false);
        clock.advance(500);
        assert_eq!(
            engine.media_position_ms(),
            2000,
            "restore resumes, not restarts"
        );
    }

    #[test]
    fn a_slide_change_restarts_media_at_zero() {
        let clock = crate::clock::ManualClock::new();
        let mut engine = ShowEngine::new(media_project()).with_clock(Arc::new(clock.clone()));

        clock.advance(4000);
        assert_eq!(engine.media_position_ms(), 4000);
        engine.next_slide();
        assert_eq!(engine.media_position_ms(), 0);
    }

    #[test]
    fn seeking_moves_the_position_without_a_transition() {
        let clock = crate::clock::ManualClock::new();
        let mut engine = ShowEngine::new(media_project()).with_clock(Arc::new(clock.clone()));

        let before = engine.revision();
        assert!(engine.seek_media(4200));
        assert_eq!(engine.media_position_ms(), 4200);
        assert_eq!(engine.revision(), before + 1);
        assert!(
            engine.state().transition.is_none(),
            "a seek is not a slide change"
        );

        clock.advance(300);
        assert_eq!(engine.media_position_ms(), 4500);
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
                    fit: crate::domain::MediaFit::Cover,
                }),
                ..Default::default()
            });

        // Absolute on the host running the test: a POSIX literal is not
        // absolute on Windows, which the Windows job rightly rejects.
        let root = std::env::temp_dir().join("cjcp-media-root");
        let engine = ShowEngine::new(project).with_media_root(&root);
        let slide = engine.state().slide;
        let media = slide.elements[1].media.as_ref().expect("a media element");
        assert!(
            media.src.starts_with(&crate::media::file_url(&root)),
            "relative paths resolve against the project: {}",
            media.src
        );
        assert!(
            media.src.ends_with("/media/clip%20one.mp4"),
            "the space is encoded: {}",
            media.src
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
                    fit: crate::domain::MediaFit::Cover,
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
