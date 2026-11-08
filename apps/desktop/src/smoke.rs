//! Automated Experiment 1.
//!
//! Runs the recovery scenario from `docs/experiments.md` without a human:
//! open four outputs, advance ten slides, close one, advance five more, reopen
//! it, and measure how long it takes to reach the live revision.
//!
//! Enabled with `CJCRSG_SMOKE=1`. Writes a JSON report to `CJCRSG_SMOKE_OUT`
//! (default `/tmp/cjcrsg-smoke.json`) and exits non-zero on failure.

use std::time::{Duration, Instant};

use dioxus::prelude::*;
use dioxus_desktop::use_window;

use crate::app::open_output;
use crate::runtime::{AppState, OutputKind, Shared};

const OPEN_TIMEOUT: Duration = Duration::from_secs(10);
const RECOVERY_TIMEOUT: Duration = Duration::from_secs(3);
const SETTLE: Duration = Duration::from_millis(250);

#[component]
pub fn Smoke() -> Element {
    let shared = use_signal(|| Shared(std::rc::Rc::new(AppState::new())));
    let window = use_window();

    use_future(move || {
        let window = window.clone();
        let app: std::rc::Rc<AppState> = shared.read().0.clone();

        async move {
            // Let the first frame settle before creating windows.
            tokio::time::sleep(Duration::from_millis(400)).await;

            let mut checks: Vec<(String, bool, String)> = Vec::new();
            let mut lines: Vec<String> = Vec::new();

            // 1. open all four outputs
            for kind in OutputKind::ALL {
                open_output(window.clone(), app.clone(), kind);
            }
            let open_ok = wait_until(OPEN_TIMEOUT, || {
                OutputKind::ALL.iter().all(|kind| app.is_open(*kind))
            })
            .await;
            checks.push((
                "four outputs open".into(),
                open_ok,
                format!("open={}", OutputKind::ALL.iter().filter(|k| app.is_open(**k)).count()),
            ));

            // 2. advance ten slides at ~2/second
            for _ in 0..10 {
                app.next_slide();
                tokio::time::sleep(Duration::from_millis(120)).await;
            }
            tokio::time::sleep(SETTLE).await;

            let revision_after_ten = app.revision();
            let all_synced = OutputKind::ALL
                .iter()
                .all(|kind| app.applied(*kind) == Some(revision_after_ten));
            checks.push((
                "all outputs reach revision after 10 advances".into(),
                all_synced,
                format!(
                    "engine={revision_after_ten} applied={:?}",
                    OutputKind::ALL
                        .iter()
                        .map(|k| (*k, app.applied(*k)))
                        .collect::<Vec<_>>()
                ),
            ));

            // 3. close the stage output and advance five more
            let closed = app.close_output(OutputKind::Stage);
            let closed_ok = wait_until(Duration::from_secs(3), || !app.is_open(OutputKind::Stage)).await;
            checks.push((
                "stage closes".into(),
                closed && closed_ok,
                format!("close_requested={closed} now_open={}", app.is_open(OutputKind::Stage)),
            ));

            let revision_before_advance = app.revision();
            for _ in 0..5 {
                app.next_slide();
                tokio::time::sleep(Duration::from_millis(120)).await;
            }
            tokio::time::sleep(SETTLE).await;

            // The engine must be untouched by a window closing.
            let engine_survived = app.revision() > revision_before_advance;
            checks.push((
                "engine keeps running with an output closed".into(),
                engine_survived,
                format!("{} -> {}", revision_before_advance, app.revision()),
            ));

            // 4. reopen and measure recovery
            let target = app.revision();
            open_output(window.clone(), app.clone(), OutputKind::Stage);

            let started = Instant::now();
            let recovered = wait_until(RECOVERY_TIMEOUT, || {
                app.applied(OutputKind::Stage) == Some(target)
            })
            .await;
            let elapsed = started.elapsed().as_millis() as u64;

            checks.push((
                "reopened output reaches the live revision".into(),
                recovered,
                format!("target={target} applied={:?} in {elapsed}ms", app.applied(OutputKind::Stage)),
            ));
            checks.push((
                "recovery under 1 s".into(),
                recovered && elapsed < 1000,
                format!("{elapsed}ms"),
            ));

            // 5. the other outputs must not have been disturbed
            tokio::time::sleep(SETTLE).await;
            let others_ok = [OutputKind::Audience, OutputKind::Preview, OutputKind::Confidence]
                .iter()
                .all(|kind| app.applied(*kind) == Some(app.revision()));
            checks.push((
                "other outputs unaffected".into(),
                others_ok,
                format!("{:?}", app.applied(OutputKind::Audience)),
            ));

            let passed = checks.iter().all(|(_, ok, _)| *ok);

            lines.push("{".to_string());
            lines.push(format!("  \"revision\": {},", app.revision()));
            lines.push(format!("  \"recovered_in_ms\": {},", elapsed));
            lines.push(format!("  \"passed\": {},", passed));
            lines.push("  \"checks\": [".to_string());
            for (i, (name, ok, detail)) in checks.iter().enumerate() {
                let comma = if i + 1 == checks.len() { "" } else { "," };
                lines.push(format!(
                    "    {{ \"name\": {:?}, \"pass\": {}, \"detail\": {:?} }}{}",
                    name, ok, detail, comma
                ));
            }
            lines.push("  ]".to_string());
            lines.push("}".to_string());

            let report = lines.join("\n");
            println!("\n--- SMOKE REPORT ---\n{report}\n--- END ---");

            let out = std::env::var("CJCRSG_SMOKE_OUT")
                .unwrap_or_else(|_| "/tmp/cjcrsg-smoke.json".to_string());
            let _ = std::fs::write(&out, &report);

            std::process::exit(if passed { 0 } else { 1 });
        }
    });

    rsx! {
        div { style: "padding:24px;font-family:system-ui;background:#111;color:#eee;height:100vh",
            h1 { "Experiment 1 running" }
            p { "Driving the scenario automatically. This window closes when it finishes." }
        }
    }
}

async fn wait_until(timeout: Duration, mut condition: impl FnMut() -> bool) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if condition() {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    condition()
}
