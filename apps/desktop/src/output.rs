//! One output window: an independent `VirtualDom` fed by the shared hub.

use std::time::Duration;

use dioxus::prelude::*;
use presenter_core::Revision;

use crate::runtime::{OutputKind, Shared};
use crate::slide::{SlideView, StageView};

#[derive(Props, Clone, PartialEq)]
pub struct OutputProps {
    pub kind: OutputKind,
    pub shared: Shared,
}

#[component]
pub fn OutputRoot(props: OutputProps) -> Element {
    let kind = props.kind;
    let shared = props.shared.0.clone();

    // Captured once per window instance. The first revision this window ever
    // renders is not animated: reopening an output must not replay a transition
    // the congregation already saw.
    let first_revision: Revision = use_hook(|| shared.engine.revision());

    // Snapshot, not the cached state: a window opening mid-clip must start at
    // the current position, not at the moment the slide was published.
    let initial = shared.engine.snapshot();
    let current = use_signal(|| initial);

    let hub = shared.engine.clone();
    use_future(move || {
        let hub = hub.clone();
        let mut current = current;
        async move {
            let mut receiver = hub.subscribe();
            loop {
                // Read through the receiver, never a separate snapshot: there is
                // then no window between "I read state" and "I am listening" in
                // which a publish could be lost.
                let snapshot = receiver.borrow_and_update().clone();
                current.set(snapshot);

                if receiver.changed().await.is_err() {
                    break;
                }
            }
        }
    });

    let reporter = shared.clone();
    use_effect(move || {
        let revision = current.read().revision;
        reporter.report_applied(kind, revision);
    });

    // Outputs lay out at 1920x1080 and scale to the window.
    use_future(|| async move {
        let script = r#"
            (() => {
                const fit = () => document.documentElement.style.setProperty(
                    "--slide-scale", String(window.innerWidth / 1920));
                fit();
                addEventListener("resize", fit);
            })();
        "#;
        let _ = document::eval(script).await;
    });

    // Experiment 3c: how many frames each output actually decodes and drops.
    // Off by default; it is a measurement harness, not a feature.
    if std::env::var("CJCRSG_MEDIA_PROBE").is_ok() {
        let output = kind.label();
        use_future(move || async move {
            loop {
                tokio::time::sleep(Duration::from_secs(2)).await;
                let mut probe = document::eval(
                    r#"
                    (() => {
                        const videos = [...document.querySelectorAll('video')];
                        dioxus.send(JSON.stringify(videos.map((video) => {
                            const quality = video.getVideoPlaybackQuality();
                            return {
                                href: location.href,
                                error: video.error ? video.error.message : null,
                                network: video.networkState,
                                t: video.currentTime,
                                total: quality.totalVideoFrames,
                                dropped: quality.droppedVideoFrames,
                                w: video.videoWidth,
                                h: video.videoHeight,
                                paused: video.paused,
                                seeking: video.seeking,
                            };
                        })));
                    })();
                    "#,
                );
                if let Ok(report) = probe.recv::<String>().await {
                    tracing::info!(output, report = %report, "media probe");
                }
            }
        });
    }

    // The countdown ticks in the page and corrects on every publication, so a
    // per-second state publish is not needed for a label.
    if kind == OutputKind::Stage {
        use_future(|| async move {
            let script = r#"
                (() => {
                    if (window.__stageTimer) return;
                    window.__stageTimer = setInterval(() => {
                        const el = document.getElementById('stage-timer');
                        if (!el) return;
                        const key = el.dataset.key;
                        if (window.__stageTimerKey !== key) {
                            window.__stageTimerKey = key;
                            window.__stageTimerLeft = Number(el.dataset.remaining);
                        }
                        if (el.dataset.running === 'true' && window.__stageTimerLeft > 0) {
                            window.__stageTimerLeft = Math.max(0, window.__stageTimerLeft - 250);
                        }
                        const seconds = Math.ceil(window.__stageTimerLeft / 1000);
                        el.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
                    }, 250);
                })();
            "#;
            let _ = document::eval(script).await;
        });
    }

    // A stage clock ticks in the page, not through Rust: a per-second state
    // publish would wake every output for a label.
    if kind == OutputKind::Stage {
        use_future(|| async move {
            let script = r#"
                (() => {
                    const tick = () => {
                        const el = document.getElementById('stage-clock');
                        if (el) el.textContent = new Date().toLocaleTimeString([], {
                            hour: '2-digit', minute: '2-digit'
                        });
                    };
                    tick();
                    setInterval(tick, 1000);
                })();
            "#;
            let _ = document::eval(script).await;
        });
    }

    let state = current.read().clone();
    let animate = state.revision != first_revision;
    let transition = state
        .transition
        .as_ref()
        .map(|transition| transition.spec())
        .unwrap_or_else(presenter_core::Transition::none);

    rsx! {
        document::Style { {crate::assets::MAIN_CSS} }
        document::Title { "CJCRSG — {kind.label()}" }

        match kind {
            OutputKind::Stage => rsx! {
                StageView {
                    current: state.slide.clone(),
                    next: state.next.clone(),
                    output: kind.label().to_string(),
                    notes: state.notes.clone(),
                    message: state.message.clone(),
                    timer: state.timer,
                }
            },
            // The operator's look-ahead: the slide after the live one, never
            // the live slide itself.
            OutputKind::Preview => rsx! {
                if let Some(next) = state.next.clone() {
                    SlideView {
                        slide: next,
                        output: kind.label().to_string(),
                        animate: false,
                        revision: 0,
                        transition: presenter_core::Transition::none(),
                        play_media: false,
                    }
                } else {
                    div { class: "slide",
                        p { class: "blank", "End of show" }
                    }
                }
            },
            // The speaker's view: the live slide plus a clock they can read.
            OutputKind::Confidence => rsx! {
                div { class: "confidence",
                    SlideView {
                        slide: state.slide.clone(),
                        output: String::new(),
                        animate,
                        revision: state.revision,
                        transition,
                        play_media: true,
                    }
                    span { class: "confidence-clock", id: "confidence-clock", "--:--" }
                }
            },
            OutputKind::Audience => rsx! {
                SlideView {
                    slide: state.slide.clone(),
                    output: kind.label().to_string(),
                    animate,
                    revision: state.revision,
                    transition,
                    play_media: true,
                }
            },
        }
    }
}
