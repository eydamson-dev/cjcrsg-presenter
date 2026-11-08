//! HTTP remote control.
//!
//! A phone joins the same network, opens the page, and drives the show. The
//! server holds no state of its own: every command goes through
//! [`SharedEngine`], so a remote client can never disagree with the engine about
//! which slide is live.
//!
//! This is deliberately not the final protocol. FreeShow's remote is Socket.IO;
//! a small JSON-over-HTTP surface is enough to prove the command path and to
//! test it without a browser.

use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse};
use axum::routing::{get, post};
use axum::{Json, Router};
use presenter_core::SharedEngine;
use serde::Serialize;

pub const DEFAULT_PORT: u16 = 5520;

pub fn router(engine: Arc<SharedEngine>) -> Router {
    Router::new()
        .route("/", get(page))
        .route("/api/state", get(state))
        .route("/api/next", post(next))
        .route("/api/previous", post(previous))
        .route("/api/first", post(first))
        .route("/api/last", post(last))
        .route("/api/clear", post(clear))
        .with_state(engine)
}

/// Bind and serve until the future is dropped.
pub async fn serve(engine: Arc<SharedEngine>, port: u16) -> std::io::Result<()> {
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!(port, "remote control listening");
    axum::serve(listener, router(engine)).await
}

#[derive(Serialize)]
struct StateBody {
    revision: u64,
    slide_id: String,
    position: usize,
    total: usize,
    cleared: bool,
    slide: presenter_core::RenderSlide,
    next: Option<presenter_core::RenderSlide>,
}

async fn state(State(engine): State<Arc<SharedEngine>>) -> Json<StateBody> {
    let snapshot = engine.state();
    let (slide_id, position, total) = engine.cursor();
    Json(StateBody {
        revision: snapshot.revision,
        slide_id,
        position,
        total,
        cleared: engine.is_cleared(),
        slide: snapshot.slide.clone(),
        next: snapshot.next.clone(),
    })
}

async fn next(State(engine): State<Arc<SharedEngine>>) -> impl IntoResponse {
    command(engine.next_slide())
}

async fn previous(State(engine): State<Arc<SharedEngine>>) -> impl IntoResponse {
    command(engine.previous_slide())
}

async fn clear(State(engine): State<Arc<SharedEngine>>) -> impl IntoResponse {
    command(engine.toggle_clear())
}

async fn first(State(engine): State<Arc<SharedEngine>>) -> impl IntoResponse {
    command(engine.first_slide())
}

async fn last(State(engine): State<Arc<SharedEngine>>) -> impl IntoResponse {
    command(engine.last_slide())
}

/// 200 when the show moved, 409 when the command was a no-op (already at the
/// end, for instance). A remote that ignores this will still work; one that
/// shows a message to the operator needs the distinction.
fn command(changed: bool) -> impl IntoResponse {
    if changed {
        StatusCode::OK
    } else {
        StatusCode::CONFLICT
    }
}

async fn page(State(engine): State<Arc<SharedEngine>>) -> Html<String> {
    let (_, position, total) = engine.cursor();
    Html(format!(
        r#"<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CJCRSG Remote</title>
<style>
body{{margin:0;font-family:system-ui;background:#0b0d10;color:#e6e8ea;
display:flex;flex-direction:column;height:100vh;justify-content:center;
align-items:center;gap:1.5rem}}
.row{{display:flex;gap:1rem}}
button{{font-size:1.5rem;padding:1.2rem 2rem;border-radius:12px;border:1px solid #2a323c;
background:#161b22;color:#e6e8ea;min-width:8rem}}
button:active{{background:#22303f}}
.pos{{font-size:1.1rem;color:#8b949e}}
</style></head>
<body>
<div class="pos">{position} / {total}</div>
<div class="row">
  <button onclick="fetch('/api/previous',{{method:'POST'}}).then(refresh)">◀</button>
  <button onclick="fetch('/api/next',{{method:'POST'}}).then(refresh)">▶</button>
</div>
<div class="row">
  <button onclick="fetch('/api/first',{{method:'POST'}}).then(refresh)">⏮</button>
  <button onclick="fetch('/api/last',{{method:'POST'}}).then(refresh)">⏭</button>
</div>
<div class="row">
  <button onclick="fetch('/api/clear',{{method:'POST'}}).then(refresh)">Clear</button>
</div>
<script>
async function refresh(){{const r=await fetch('/api/state');const s=await r.json();
document.querySelector('.pos').textContent=s.position+' / '+s.total;}}
setInterval(refresh, 1000);
</script>
</body></html>"#
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use presenter_core::{Project, Show, ShowEngine, Slide, SlideGroup};
    use tower::ServiceExt;

    fn engine() -> Arc<SharedEngine> {
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
        Arc::new(SharedEngine::new(ShowEngine::new(project)))
    }

    async fn body_text(response: axum::response::Response) -> String {
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 64)
            .await
            .unwrap();
        String::from_utf8(bytes.to_vec()).unwrap()
    }

    #[tokio::test]
    async fn state_reports_position_and_slide() {
        let app = router(engine());
        let response = app
            .oneshot(Request::get("/api/state").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = body_text(response).await;
        assert!(body.contains("\"slide_id\":\"a\""), "{body}");
        assert!(body.contains("\"position\":1"), "{body}");
        assert!(body.contains("\"total\":3"), "{body}");
    }

    #[tokio::test]
    async fn next_advances_the_engine() {
        let shared = engine();
        let app = router(shared.clone());

        let response = app
            .clone()
            .oneshot(Request::post("/api/next").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(shared.state().slide_id, "b");

        // And the state endpoint agrees.
        let body = body_text(
            app.oneshot(Request::get("/api/state").body(Body::empty()).unwrap())
                .await
                .unwrap(),
        )
        .await;
        assert!(body.contains("\"slide_id\":\"b\""), "{body}");
    }

    #[tokio::test]
    async fn a_no_op_command_reports_conflict() {
        let shared = engine();
        let app = router(shared.clone());
        let response = app
            .oneshot(Request::post("/api/previous").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CONFLICT);
        assert_eq!(shared.revision(), 0);
    }

    #[tokio::test]
    async fn clear_toggles_without_moving() {
        let shared = engine();
        let app = router(shared.clone());
        let response = app
            .clone()
            .oneshot(Request::post("/api/clear").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let snapshot = shared.state();
        assert!(snapshot.slide.is_blank());
        assert_eq!(snapshot.slide_id, "a");

        let body = body_text(
            app.oneshot(Request::get("/api/state").body(Body::empty()).unwrap())
                .await
                .unwrap(),
        )
        .await;
        assert!(body.contains("\"cleared\":true"), "{body}");
    }

    #[tokio::test]
    async fn first_and_last_jump() {
        let shared = engine();
        shared.last_slide();
        assert_eq!(shared.state().slide_id, "c");

        let app = router(shared.clone());
        let response = app
            .oneshot(Request::post("/api/first").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(shared.state().slide_id, "a");
    }

    #[tokio::test]
    async fn the_page_renders_position() {
        let app = router(engine());
        let response = app
            .oneshot(Request::get("/").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = body_text(response).await;
        assert!(body.contains("1 / 3"), "{body}");
        assert!(body.contains("/api/next"), "{body}");
    }
}
