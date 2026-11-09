//! The controller's bottom drawer: tab strip, tab content and clock.
//!
//! The drawer is local UI state, not part of the show. It reads the project's
//! shows and media through [`crate::runtime::AppState`] and never publishes a
//! render state of its own; the engine remains the only thing that decides what
//! is live.

use dioxus::prelude::*;
use presenter_core::{Project, DEFAULT_DRAWER_HEIGHT, MAX_DRAWER_HEIGHT};

use crate::media_panel::{MediaItem, MediaList};

/// The strip is the whole drawer when collapsed.
pub const COLLAPSED_HEIGHT: u32 = presenter_core::MIN_DRAWER_HEIGHT;
/// A release below this collapses instead of keeping the dragged height (B4).
pub const COLLAPSE_THRESHOLD: u32 = 80;
/// The open height when nothing else is remembered (B1).
pub const DEFAULT_OPEN_HEIGHT: u32 = DEFAULT_DRAWER_HEIGHT;

/// The eight tabs, in FreeShow's strip order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrawerTab {
    Shows,
    Media,
    Audio,
    Overlays,
    Templates,
    Scripture,
    Calendar,
    Functions,
}

impl DrawerTab {
    pub const ALL: [DrawerTab; 8] = [
        DrawerTab::Shows,
        DrawerTab::Media,
        DrawerTab::Audio,
        DrawerTab::Overlays,
        DrawerTab::Templates,
        DrawerTab::Scripture,
        DrawerTab::Calendar,
        DrawerTab::Functions,
    ];

    pub fn index(self) -> usize {
        Self::ALL
            .iter()
            .position(|tab| *tab == self)
            .unwrap_or_default()
    }

    /// The visible label, including the Ctrl hint. The scenario asserts these
    /// exact strings, so the number is part of the label (B2).
    pub fn label(self) -> &'static str {
        match self {
            DrawerTab::Shows => "1 Shows",
            DrawerTab::Media => "2 Media",
            DrawerTab::Audio => "3 Audio",
            DrawerTab::Overlays => "4 Overlays",
            DrawerTab::Templates => "5 Templates",
            DrawerTab::Scripture => "6 Scripture",
            DrawerTab::Calendar => "7 Calendar",
            DrawerTab::Functions => "8 Functions",
        }
    }

    /// The tab name without its shortcut digit, for empty-state headings.
    pub fn name(self) -> &'static str {
        match self {
            DrawerTab::Shows => "Shows",
            DrawerTab::Media => "Media",
            DrawerTab::Audio => "Audio",
            DrawerTab::Overlays => "Overlays",
            DrawerTab::Templates => "Templates",
            DrawerTab::Scripture => "Scripture",
            DrawerTab::Calendar => "Calendar",
            DrawerTab::Functions => "Functions",
        }
    }

    /// The one sentence a tab with no library behind it shows (B10).
    pub fn empty_state(self) -> Option<&'static str> {
        match self {
            DrawerTab::Shows | DrawerTab::Media | DrawerTab::Audio => None,
            DrawerTab::Overlays => Some("No overlay library in this build."),
            DrawerTab::Templates => Some("No template library in this build."),
            DrawerTab::Scripture => Some("No Bible translation loaded."),
            DrawerTab::Calendar => Some("No calendar source connected."),
            DrawerTab::Functions => Some("No action library in this build."),
        }
    }

    /// Map the key chord the page sends for `Ctrl+1..8` (B6).
    pub fn from_shortcut(key: &str) -> Option<Self> {
        let digit = key.strip_prefix("Ctrl+")?;
        let position = digit.parse::<usize>().ok()?.checked_sub(1)?;
        Self::ALL.get(position).copied()
    }
}

/// One show in the Shows tab; the live marker is applied at render time.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShowRow {
    pub index: usize,
    pub name: String,
    pub slide_count: usize,
}

pub fn build_shows(project: &Project) -> Vec<ShowRow> {
    project
        .shows
        .iter()
        .enumerate()
        .map(|(index, show)| ShowRow {
            index,
            name: show.name.clone(),
            slide_count: show.slide_count(),
        })
        .collect()
}

/// Everything the active tab can draw. Grouped so the component keeps a
/// readable prop list as more tabs gain content.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DrawerContent {
    pub shows: Vec<ShowRow>,
    pub live_show: Option<usize>,
    pub media: Vec<MediaItem>,
    pub audio: Vec<MediaItem>,
}

/// The measured content box: the drawer may use everything below the top bar.
///
/// Both numbers come from the page, so `100vh - var(--topbar-h)` in CSS and
/// this value in Rust describe the same limit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Viewport {
    pub inner_height: u32,
    pub top_bar_height: u32,
}

impl Viewport {
    pub fn max_height(self) -> u32 {
        self.inner_height
            .saturating_sub(self.top_bar_height)
            .max(COLLAPSED_HEIGHT)
    }
}

/// The largest height the window can give the drawer (B1): the space below the
/// top bar, not FreeShow's literal 40 px (our bar is taller).
///
/// Before the page has reported its measurements, the session's own maximum is
/// used; CSS also caps the rendered drawer, so the first frame cannot overflow.
pub fn max_height(viewport: Option<Viewport>) -> u32 {
    viewport
        .map(Viewport::max_height)
        .unwrap_or(MAX_DRAWER_HEIGHT)
}

/// The height a collapsed drawer opens at (B5).
///
/// A remembered value below 300 is deliberately raised to 300: a drawer that
/// was dragged small must not reopen cramped on the next click.
pub fn remembered_open_height(remembered: u32, max: u32) -> u32 {
    let max = max.max(COLLAPSED_HEIGHT);
    remembered
        .max(DEFAULT_OPEN_HEIGHT)
        .min(max)
        .max(COLLAPSED_HEIGHT)
}

/// Clamp a height reported by the page into the drawer's range (B4).
pub fn clamp_drag_height(raw: i64, max: u32) -> u32 {
    let max = max.max(COLLAPSED_HEIGHT);
    raw.clamp(COLLAPSED_HEIGHT as i64, max as i64) as u32
}

#[component]
pub fn Drawer(
    active: DrawerTab,
    height: u32,
    content: DrawerContent,
    on_select: EventHandler<DrawerTab>,
    on_toggle: EventHandler<()>,
    on_collapse: EventHandler<DrawerTab>,
    on_play_show: EventHandler<usize>,
) -> Element {
    rsx! {
        div { class: "drawer", style: "--drawer-h: {height}px;",
            div {
                class: "drawer-top",
                onclick: move |_| on_toggle.call(()),
                div { class: "drawer-tabs",
                    for tab in DrawerTab::ALL {
                        button {
                            key: "{tab.index()}",
                            class: if tab == active { "drawer-tab active" } else { "drawer-tab" },
                            onclick: move |event| {
                                event.stop_propagation();
                                on_select.call(tab);
                            },
                            ondoubleclick: move |event| {
                                event.stop_propagation();
                                on_collapse.call(tab);
                            },
                            "{tab.label()}"
                        }
                    }
                }
            }

            div { class: "drawer-body",
                div { class: "drawer-content",
                    match active {
                        DrawerTab::Shows => rsx! {
                            ShowList { shows: content.shows, live_show: content.live_show, on_play_show }
                        },
                        DrawerTab::Media => rsx! {
                            if content.media.is_empty() {
                                p { class: "hint", "This project references no media." }
                            } else {
                                MediaList { items: content.media }
                            }
                        },
                        DrawerTab::Audio => rsx! {
                            if content.audio.is_empty() {
                                p { class: "hint", "This project references no audio." }
                            } else {
                                MediaList { items: content.audio }
                            }
                        },
                        _ => rsx! {
                            div { class: "drawer-empty",
                                h2 { "{active.name()}" }
                                p { "{active.empty_state().unwrap_or_default()}" }
                            }
                        },
                    }
                }
                DrawerClock {}
            }
        }
    }
}

#[component]
fn ShowList(
    shows: Vec<ShowRow>,
    live_show: Option<usize>,
    on_play_show: EventHandler<usize>,
) -> Element {
    rsx! {
        if shows.is_empty() {
            p { class: "hint", "No shows in this project." }
        } else {
            div { class: "show-list",
                for show in shows.iter().cloned() {
                    div {
                        key: "show-{show.index}",
                        class: if live_show == Some(show.index) { "show-row current" } else { "show-row" },
                        span { class: "name", "{show.name}" }
                        span { class: "show-count", "{show.slide_count} slides" }
                        if live_show == Some(show.index) {
                            span { class: "show-live", "live" }
                        }
                        button {
                            class: "btn small",
                            onclick: move |_| on_play_show.call(show.index),
                            "Play"
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn DrawerClock() -> Element {
    use_future(|| async {
        let _ = document::eval(CLOCK_SCRIPT).await;
    });

    rsx! {
        aside { class: "drawer-info",
            div { class: "drawer-clock",
                div { class: "drawer-clock-time", id: "drawer-clock-time", "--:--:--" }
                div { class: "drawer-clock-date", id: "drawer-clock-date" }
            }
        }
    }
}

/// The clock runs in the page, so it needs no Rust timer and keeps the seconds
/// honest even while the controller's own 250 ms tick is busy. `HH:mm:ss`,
/// 24-hour, with a long-form date underneath (B11).
const CLOCK_SCRIPT: &str = r#"
    (() => {
        if (window.__cjcpDrawerClock) clearInterval(window.__cjcpDrawerClock);
        const pad = (value) => String(value).padStart(2, '0');
        const paint = () => {
            const time = document.getElementById('drawer-clock-time');
            const date = document.getElementById('drawer-clock-date');
            const now = new Date();
            if (time) {
                time.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
            }
            if (date) {
                const long = now.toLocaleDateString(undefined, {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                });
                date.textContent = long.charAt(0).toUpperCase() + long.slice(1);
            }
        };
        paint();
        window.__cjcpDrawerClock = setInterval(paint, 500);
    })();
"#;

/// Drag-to-resize and viewport reporting, delegated from the document because
/// the strip is a static element and the pointer may leave it mid-gesture.
///
/// The drag itself is page-local: it moves a CSS custom property so the WebView
/// repaints, and tells Rust only the released height. That keeps the engine out
/// of the pointer loop (AGENTS.md invariant 6).
pub const DRAWER_SCRIPT: &str = r#"
    (() => {
        if (window.__cjcpDrawer) return;
        window.__cjcpDrawer = true;

        const root = document.documentElement;

        // The maximum is the space below the real top bar (B1); both CSS and
        // the drag use the measured value, so they cannot disagree.
        const syncTopBar = () => {
            const bar = document.querySelector('.topbar');
            const height = bar ? Math.round(bar.getBoundingClientRect().height) : 56;
            root.style.setProperty('--topbar-h', height + 'px');
            return height;
        };

        const reportViewport = () => {
            dioxus.send(JSON.stringify({
                kind: 'viewport',
                height: Math.round(window.innerHeight),
                top_bar: syncTopBar(),
            }));
        };
        reportViewport();
        requestAnimationFrame(reportViewport);
        window.setTimeout(reportViewport, 500);
        window.addEventListener('resize', reportViewport);
        const bar = document.querySelector('.topbar');
        if (bar && 'ResizeObserver' in window) {
            new ResizeObserver(reportViewport).observe(bar);
        }

        document.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const strip = event.target.closest && event.target.closest('.drawer-top');
            if (!strip) return;
            const drawer = document.querySelector('.drawer');
            if (!drawer) return;

            const startY = event.clientY;
            let height = Math.round(drawer.getBoundingClientRect().height);
            let moved = false;
            // Keep the drawer top under the grab point, as FreeShow does. A
            // pointerdown 2 px below the top edge must not teleport the edge to
            // the pointer.
            const offsetY = Math.round(window.innerHeight) - height - startY;
            const maxHeight = Math.max(
                40,
                Math.round(window.innerHeight) - syncTopBar(),
            );

            root.style.setProperty('--drawer-drag-h', height + 'px');
            document.body.classList.add('drawer-dragging');

            const move = (ev) => {
                height = Math.round(window.innerHeight - ev.clientY - offsetY);
                height = Math.max(40, Math.min(maxHeight, height));
                // Any pointermove means the gesture is a drag, not a click.
                moved = true;
                root.style.setProperty('--drawer-drag-h', height + 'px');
            };
            const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', up);
                document.body.classList.remove('drawer-dragging');
                drawer.style.setProperty('--drawer-h', height + 'px');
                if (!moved) return;
                window.__cjcpSuppressClickUntil = performance.now() + 80;
                dioxus.send(JSON.stringify({
                    kind: 'drawer_resize',
                    height,
                    inner_height: Math.round(window.innerHeight),
                    top_bar: syncTopBar(),
                }));
            };

            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
            window.addEventListener('pointercancel', up);
        }, true);

        document.addEventListener('click', (event) => {
            const until = window.__cjcpSuppressClickUntil || 0;
            if (performance.now() > until) return;
            window.__cjcpSuppressClickUntil = 0;
            event.stopPropagation();
            event.preventDefault();
        }, true);
    })();
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use presenter_core::{Show, Slide, SlideGroup};

    #[test]
    fn tabs_are_in_freeshow_order_with_their_labels() {
        let labels: Vec<&str> = DrawerTab::ALL.iter().map(|tab| tab.label()).collect();
        assert_eq!(
            labels,
            [
                "1 Shows",
                "2 Media",
                "3 Audio",
                "4 Overlays",
                "5 Templates",
                "6 Scripture",
                "7 Calendar",
                "8 Functions",
            ]
        );
        assert_eq!(DrawerTab::Shows.name(), "Shows");
        assert_eq!(DrawerTab::Shows.index(), 0);
        assert_eq!(DrawerTab::Functions.index(), 7);
    }

    #[test]
    fn ctrl_digits_select_the_tab_at_that_position() {
        for (position, tab) in DrawerTab::ALL.iter().enumerate() {
            let key = format!("Ctrl+{}", position + 1);
            assert_eq!(DrawerTab::from_shortcut(&key), Some(*tab), "{key}");
        }
    }

    #[test]
    fn only_ctrl_digits_one_to_eight_are_drawer_shortcuts() {
        for key in ["Ctrl+0", "Ctrl+9", "Ctrl+D", "Ctrl+T", "1", "Ctrl+", ""] {
            assert_eq!(DrawerTab::from_shortcut(key), None, "{key:?}");
        }
    }

    #[test]
    fn the_five_library_tabs_each_state_why_they_are_empty() {
        for (tab, expected) in [
            (DrawerTab::Overlays, "no overlay library in this build"),
            (DrawerTab::Templates, "no template library in this build"),
            (DrawerTab::Scripture, "no bible translation loaded"),
            (DrawerTab::Calendar, "no calendar source connected"),
            (DrawerTab::Functions, "no action library in this build"),
        ] {
            let sentence = tab.empty_state().unwrap_or_default().to_lowercase();
            assert!(sentence.contains(expected), "{tab:?}: {sentence}");
        }
        for tab in [DrawerTab::Shows, DrawerTab::Media, DrawerTab::Audio] {
            assert_eq!(tab.empty_state(), None, "{tab:?}");
        }
    }

    #[test]
    fn a_remembered_height_below_the_default_reopens_at_300() {
        assert_eq!(remembered_open_height(40, 744), 300);
        assert_eq!(remembered_open_height(80, 744), 300);
        assert_eq!(remembered_open_height(299, 744), 300);
        assert_eq!(remembered_open_height(300, 744), 300);
    }

    #[test]
    fn a_remembered_height_above_the_default_is_kept_and_window_clamped() {
        assert_eq!(remembered_open_height(520, 744), 520);
        assert_eq!(remembered_open_height(1200, 744), 744);
        assert_eq!(remembered_open_height(1200, 1344), 1200);
        assert_eq!(remembered_open_height(520, 40), 40);
    }

    #[test]
    fn drag_heights_are_clamped_to_the_drawer_range() {
        let at_800 = Viewport {
            inner_height: 800,
            top_bar_height: 56,
        };
        assert_eq!(at_800.max_height(), 744);
        assert_eq!(max_height(Some(at_800)), 744);
        assert_eq!(
            max_height(Some(Viewport {
                inner_height: 800,
                top_bar_height: 40,
            })),
            760
        );
        assert_eq!(
            max_height(Some(Viewport {
                inner_height: 1400,
                top_bar_height: 56,
            })),
            1344
        );
        assert_eq!(
            max_height(Some(Viewport {
                inner_height: 50,
                top_bar_height: 56,
            })),
            40
        );
        assert_eq!(max_height(None), 1200);

        assert_eq!(clamp_drag_height(0, 744), 40);
        assert_eq!(clamp_drag_height(-20, 744), 40);
        assert_eq!(clamp_drag_height(520, 744), 520);
        assert_eq!(clamp_drag_height(2000, 744), 744);
    }

    /// The page's drag formula, mirrored here so the grab offset is checked
    /// without a window: offset = innerHeight - height - grabY at pointerdown,
    /// then height = innerHeight - pointerY - offset on every move.
    #[test]
    fn drag_height_keeps_the_pointer_at_its_grab_offset() {
        let inner = 800i64;
        let start_height = 300u32;
        let grab_y = 520i64; // 20 px below the drawer top at 500
        let offset = inner - start_height as i64 - grab_y;

        let height_at = |pointer_y: i64| inner - pointer_y - offset;
        assert_eq!(height_at(grab_y), 300, "no move keeps the height");
        assert_eq!(height_at(grab_y - 1), 301, "one px up grows by one");
        assert_eq!(height_at(grab_y + 1), 299, "one px down shrinks by one");

        // The grab point stays 20 px below the drawer top at every position.
        for pointer_y in [200, 400, 520, 700] {
            let height = height_at(pointer_y);
            let top = inner - height;
            assert_eq!(pointer_y - top, 20, "grab offset at pointer y={pointer_y}");
        }
    }

    #[test]
    fn shows_carry_project_order_and_slide_counts() {
        fn show(id: &str, name: &str, slides: usize) -> Show {
            Show {
                id: id.into(),
                name: name.into(),
                groups: vec![SlideGroup {
                    id: format!("{id}-group"),
                    name: "Group".into(),
                    slides: (0..slides)
                        .map(|index| Slide {
                            id: format!("{id}-{index}"),
                            ..Default::default()
                        })
                        .collect(),
                    ..Default::default()
                }],
                ..Default::default()
            }
        }

        let project = Project {
            shows: vec![
                show("w", "Worship", 3),
                show("a", "Announcements", 2),
                show("c", "Communion", 4),
            ],
            ..Default::default()
        };

        let rows = build_shows(&project);
        let summary: Vec<(&str, usize)> = rows
            .iter()
            .map(|row| (row.name.as_str(), row.slide_count))
            .collect();
        assert_eq!(
            summary,
            [("Worship", 3), ("Announcements", 2), ("Communion", 4)]
        );
        assert_eq!(rows[1].index, 1);
    }
}
