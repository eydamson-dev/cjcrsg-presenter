//! Loopback HTTP server for project media.
//!
//! The app's page is loaded from `dioxus://`, and a WebView on a non-file
//! origin refuses `file://` subresources. Measured in the real app: the video
//! element existed but stayed at `networkState 3` (NETWORK_NO_SOURCE) with zero
//! frames — no error, no playback. The SSR harness hid this because it loads
//! the page itself from `file://`.
//!
//! Serving the same files over `127.0.0.1` lets the WebView stream them and
//! seek with Range requests. Only files the loaded project references are
//! served, so the port cannot be used to read anything else on the machine.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::extract::{Path as RoutePath, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use presenter_core::Project;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio_util::io::ReaderStream;

/// The set of files the current project may serve.
#[derive(Clone, Default)]
pub struct MediaAccess {
    allowed: Arc<Mutex<HashSet<PathBuf>>>,
}

impl MediaAccess {
    /// Replace the allowlist with every file the project references.
    pub fn allow_project(&self, project: &Project, root: &Path) {
        let mut set = self
            .allowed
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        set.clear();

        let resolve = |stored: &str| {
            let path = Path::new(stored);
            let full = if path.is_absolute() {
                path.to_path_buf()
            } else {
                root.join(path)
            };
            std::fs::canonicalize(full).ok()
        };

        for asset in project
            .media
            .iter()
            .chain(project.shows.iter().flat_map(|show| show.media.iter()))
        {
            if let Some(path) = resolve(&asset.path) {
                set.insert(path);
            }
        }

        for show in &project.shows {
            for (_group, slide) in show.slides() {
                for element in &slide.elements {
                    if let Some(media) = &element.media {
                        if let Some(path) = resolve(&media.path) {
                            set.insert(path);
                        }
                    }
                }
            }
        }
    }

    fn allows(&self, path: &Path) -> bool {
        self.allowed
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .contains(path)
    }
}

pub struct MediaServer {
    base_url: String,
    pub access: MediaAccess,
}

impl MediaServer {
    /// e.g. `http://127.0.0.1:41237`
    pub fn base_url(&self) -> &str {
        &self.base_url
    }
}

/// Bind an ephemeral loopback port and serve until the process exits.
pub fn start() -> MediaServer {
    let access = MediaAccess::default();
    let router = Router::new()
        .route("/media/{*path}", get(serve))
        .with_state(access.clone());

    let listener = match std::net::TcpListener::bind(("127.0.0.1", 0)) {
        Ok(listener) => listener,
        Err(error) => {
            tracing::error!(%error, "could not bind the media server; media will not play");
            return MediaServer {
                base_url: String::new(),
                access,
            };
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    let _ = listener.set_nonblocking(true);

    std::thread::spawn(move || {
        let Ok(runtime) = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        else {
            tracing::error!("could not start the media runtime");
            return;
        };

        runtime.block_on(async move {
            match tokio::net::TcpListener::from_std(listener) {
                Ok(listener) => {
                    if let Err(error) = axum::serve(listener, router).await {
                        tracing::error!(%error, "media server stopped");
                    }
                }
                Err(error) => tracing::error!(%error, "media listener could not start"),
            }
        });
    });

    MediaServer {
        base_url: format!("http://127.0.0.1:{port}"),
        access,
    }
}

async fn serve(
    State(access): State<MediaAccess>,
    RoutePath(path): RoutePath<String>,
    headers: HeaderMap,
) -> Response {
    let candidate = presenter_core::media::component_to_path(&path);

    let Ok(canonical) = std::fs::canonicalize(&candidate) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if !access.allows(&canonical) {
        return StatusCode::NOT_FOUND.into_response();
    }

    let Ok(metadata) = tokio::fs::metadata(&canonical).await else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if !metadata.is_file() || metadata.len() == 0 {
        return StatusCode::NOT_FOUND.into_response();
    }

    let len = metadata.len();
    let requested = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| parse_range(value, len));
    let (start, end, partial) = match requested {
        Some((start, end)) => (start, end, true),
        None => (0, len - 1, false),
    };

    let Ok(mut file) = tokio::fs::File::open(&canonical).await else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if start > 0 && file.seek(SeekFrom::Start(start)).await.is_err() {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }

    let body = Body::from_stream(ReaderStream::new(file.take(end - start + 1)));
    let mut response = Response::builder()
        .status(if partial {
            StatusCode::PARTIAL_CONTENT
        } else {
            StatusCode::OK
        })
        .header(header::CONTENT_TYPE, content_type(&canonical))
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, (end - start + 1).to_string())
        .header(header::CACHE_CONTROL, "no-store");

    if partial {
        response = response.header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}"));
    }

    response
        .body(body)
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// Only `bytes=start-` and `bytes=start-end`. A malformed or unsatisfiable
/// range falls back to the whole file, which is always a correct answer.
fn parse_range(value: &str, len: u64) -> Option<(u64, u64)> {
    let spec = value.strip_prefix("bytes=")?;
    let (start, end) = spec.split_once('-')?;
    let start: u64 = start.parse().ok()?;
    if start >= len {
        return None;
    }
    let end = if end.is_empty() {
        len - 1
    } else {
        end.parse::<u64>().ok()?.min(len - 1)
    };
    if end < start {
        return None;
    }
    Some((start, end))
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "mov" => "video/quicktime",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "mp3" => "audio/mpeg",
        "m4a" | "aac" => "audio/mp4",
        "wav" => "audio/wav",
        "ogg" | "oga" => "audio/ogg",
        "flac" => "audio/flac",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use presenter_core::{MediaKind, MediaOrigin, MediaRef, Show, Slide, SlideElement, SlideGroup};

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("cjcp-media-srv-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn only_files_the_project_references_are_allowed() {
        let root = scratch("allow");
        let inside = root.join("media/clip.webm");
        std::fs::create_dir_all(inside.parent().unwrap()).unwrap();
        std::fs::write(&inside, b"video").unwrap();
        let outside = root.join("secret.txt");
        std::fs::write(&outside, b"secret").unwrap();

        let project = Project {
            media: vec![presenter_core::MediaAsset::new(
                "m1",
                MediaKind::Video,
                "media/clip.webm",
            )],
            shows: vec![Show {
                groups: vec![SlideGroup {
                    slides: vec![Slide {
                        elements: vec![SlideElement {
                            id: "e".into(),
                            class_name: "media".into(),
                            media: Some(MediaRef {
                                path: root.join("media/clip.webm").to_string_lossy().to_string(),
                                kind: MediaKind::Video,
                                origin: MediaOrigin::External,
                                looped: false,
                                muted: true,
                                fit: presenter_core::MediaFit::Cover,
                            }),
                            ..Default::default()
                        }],
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                ..Default::default()
            }],
            ..Default::default()
        };

        let access = MediaAccess::default();
        access.allow_project(&project, &root);

        assert!(access.allows(&std::fs::canonicalize(&inside).unwrap()));
        assert!(
            !access.allows(&std::fs::canonicalize(&outside).unwrap()),
            "a file the project does not reference must not be served"
        );
        assert!(!access.allows(Path::new("/etc/passwd")));

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn ranges_are_parsed_and_clamped() {
        assert_eq!(parse_range("bytes=0-99", 1000), Some((0, 99)));
        assert_eq!(parse_range("bytes=990-", 1000), Some((990, 999)));
        assert_eq!(parse_range("bytes=0-5000", 1000), Some((0, 999)));
        assert_eq!(parse_range("bytes=1000-", 1000), None);
        assert_eq!(parse_range("items=0-1", 1000), None);
        assert_eq!(parse_range("bytes=50-10", 1000), None);
        assert_eq!(parse_range("bytes=abc-", 1000), None);
    }

    #[test]
    fn content_types_cover_the_formats_freeshow_imports() {
        assert_eq!(content_type(Path::new("a.webm")), "video/webm");
        assert_eq!(content_type(Path::new("a.MP4")), "video/mp4");
        assert_eq!(content_type(Path::new("a.jpeg")), "image/jpeg");
        assert_eq!(content_type(Path::new("a.mp3")), "audio/mpeg");
        assert_eq!(content_type(Path::new("a.bin")), "application/octet-stream");
    }
}
