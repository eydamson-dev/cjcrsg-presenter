//! Importing PDFs and office documents as image slides.
//!
//! Churches arrive with decks already built. FreeShow solves this the same way
//! we do: rasterise the document and show one image per page. The rasterising is
//! done by external tools rather than by linking a PDF engine into the app:
//!
//! - `pdftoppm` (poppler) for PDF pages;
//! - `soffice` (LibreOffice) to convert PPTX/DOCX/ODP/ODT to PDF first.
//!
//! Both are optional at build time and required at import time. A missing tool
//! is a typed error naming it, not a silent empty project.

use std::path::{Path, PathBuf};
use std::process::Command;

use presenter_core::{
    MediaFit, MediaKind, MediaOrigin, MediaRef, Project, Show, Slide, SlideElement, SlideGroup,
};

#[derive(Debug, thiserror::Error)]
pub enum DocumentError {
    #[error("cannot run {tool}: {source}")]
    Tool {
        tool: &'static str,
        #[source]
        source: std::io::Error,
    },

    #[error("{tool} failed: {stderr}")]
    Command { tool: &'static str, stderr: String },

    #[error("the document produced no pages")]
    NoPages,

    #[error(transparent)]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Clone, Copy)]
pub struct ImportOptions {
    /// Rasterising resolution. 150 dpi gives ~1240×1754 for A4, enough for a
    /// 1080p slide without keeping 300 dpi files around.
    pub dpi: u32,
}

impl Default for ImportOptions {
    fn default() -> Self {
        Self { dpi: 150 }
    }
}

/// Rasterise every page of `pdf` and return a one-slide-per-page project.
pub fn import_pdf(
    pdf: &Path,
    project_root: &Path,
    options: ImportOptions,
) -> Result<Project, DocumentError> {
    let name = stem_of(pdf);
    let page_dir = project_root.join("media").join(&name);
    std::fs::create_dir_all(&page_dir)?;

    // A re-import replaces this document's pages, and only this document's.
    for entry in std::fs::read_dir(&page_dir)? {
        let path = entry?.path();
        if path.extension().and_then(|e| e.to_str()) == Some("png") {
            let _ = std::fs::remove_file(path);
        }
    }

    let prefix = page_dir.join("page");
    let output = Command::new("pdftoppm")
        .args(["-png", "-r", &options.dpi.to_string()])
        .arg(pdf)
        .arg(&prefix)
        .output()
        .map_err(|source| DocumentError::Tool {
            tool: "pdftoppm",
            source,
        })?;

    if !output.status.success() {
        return Err(DocumentError::Command {
            tool: "pdftoppm",
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        });
    }

    let mut pages: Vec<PathBuf> = std::fs::read_dir(&page_dir)?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|e| e.to_str()) == Some("png"))
        .collect();
    pages.sort_by_key(|path| page_number(path));

    project_from_pages(&name, &pages, project_root)
}

/// Convert an office document with LibreOffice, then import the PDF.
pub fn import_deck(
    deck: &Path,
    project_root: &Path,
    options: ImportOptions,
) -> Result<Project, DocumentError> {
    let name = stem_of(deck);
    let scratch = std::env::temp_dir().join(format!(
        "cjcp-deck-{}-{}",
        std::process::id(),
        sanitise(&name)
    ));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(&scratch)?;

    let result = (|| {
        let output = Command::new("soffice")
            .args(["--headless", "--convert-to", "pdf", "--outdir"])
            .arg(&scratch)
            .arg(deck)
            .output()
            .map_err(|source| DocumentError::Tool {
                tool: "soffice",
                source,
            })?;

        if !output.status.success() {
            return Err(DocumentError::Command {
                tool: "soffice",
                stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            });
        }

        let pdf = std::fs::read_dir(&scratch)?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .find(|path| path.extension().and_then(|e| e.to_str()) == Some("pdf"))
            .ok_or(DocumentError::NoPages)?;

        import_pdf(&pdf, project_root, options)
    })();

    let _ = std::fs::remove_dir_all(&scratch);
    result
}

/// Build the project from rendered page images. Public so it can be tested
/// without poppler or LibreOffice installed.
pub fn project_from_pages(
    name: &str,
    pages: &[PathBuf],
    project_root: &Path,
) -> Result<Project, DocumentError> {
    if pages.is_empty() {
        return Err(DocumentError::NoPages);
    }

    let media: Vec<presenter_core::MediaAsset> = pages
        .iter()
        .enumerate()
        .map(|(index, page)| {
            presenter_core::MediaAsset::new(
                format!("page-{}", index + 1),
                MediaKind::Image,
                relative_path(page, project_root),
            )
        })
        .collect();

    let slides: Vec<Slide> = pages
        .iter()
        .enumerate()
        .map(|(index, page)| {
            let id = format!("page-{}", index + 1);
            Slide {
                id: id.clone(),
                name: format!("Page {}", index + 1),
                elements: vec![SlideElement {
                    id: format!("{id}-image"),
                    class_name: "media".to_string(),
                    media: Some(MediaRef {
                        path: relative_path(page, project_root),
                        kind: MediaKind::Image,
                        origin: MediaOrigin::Bundled,
                        looped: false,
                        muted: true,
                        fit: MediaFit::Contain,
                    }),
                    ..Default::default()
                }],
                ..Default::default()
            }
        })
        .collect();

    let mut project = Project {
        id: "document".to_string(),
        name: name.to_string(),
        shows: vec![Show {
            id: "document".to_string(),
            name: name.to_string(),
            groups: vec![SlideGroup {
                id: "pages".to_string(),
                name: "Pages".to_string(),
                slides,
                ..Default::default()
            }],
            media,
            ..Default::default()
        }],
        ..Default::default()
    };
    // The project list is what `inspect` and packaging read.
    project.collect_media();
    Ok(project)
}

/// Forward-slashed path relative to the project root, as the format requires.
fn relative_path(page: &Path, project_root: &Path) -> String {
    let canonical_page = std::fs::canonicalize(page).unwrap_or_else(|_| page.to_path_buf());
    let canonical_root =
        std::fs::canonicalize(project_root).unwrap_or_else(|_| project_root.to_path_buf());
    let relative = canonical_page
        .strip_prefix(&canonical_root)
        .map(Path::to_path_buf)
        .unwrap_or(canonical_page);
    relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join("/")
}

fn stem_of(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .map(sanitise)
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "document".to_string())
}

fn sanitise(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// `page-12.png` → 12, so page 10 sorts after page 9.
fn page_number(path: &Path) -> u32 {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .and_then(|stem| stem.rsplit_once('-'))
        .and_then(|(_, number)| number.parse().ok())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("cjcp-documents-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("media/demo")).unwrap();
        dir
    }

    #[test]
    fn pages_become_slides_with_relative_contain_images() {
        let root = scratch("pages");
        let pages: Vec<PathBuf> = (1..=3)
            .map(|n| {
                let path = root.join(format!("media/demo/page-{n}.png"));
                std::fs::write(&path, b"png").unwrap();
                path
            })
            .collect();

        let project = project_from_pages("sermon notes", &pages, &root).unwrap();
        assert_eq!(project.name, "sermon notes");
        assert_eq!(project.slide_count(), 3);

        let slides: Vec<&Slide> = project
            .shows
            .iter()
            .flat_map(|show| show.slides().map(|(_, slide)| slide))
            .collect();
        for (index, slide) in slides.iter().enumerate() {
            assert_eq!(slide.id, format!("page-{}", index + 1));
            let media = slide.elements[0].media.as_ref().expect("an image element");
            assert_eq!(
                media.path,
                format!("media/demo/page-{}.png", index + 1),
                "bundled paths are relative and forward-slashed"
            );
            assert_eq!(media.kind, MediaKind::Image);
            assert_eq!(media.origin, MediaOrigin::Bundled);
            assert_eq!(media.fit, MediaFit::Contain, "documents must not crop");
        }

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn page_numbers_sort_numerically_not_lexically() {
        let mut paths = vec![
            PathBuf::from("page-10.png"),
            PathBuf::from("page-2.png"),
            PathBuf::from("page-1.png"),
        ];
        paths.sort_by_key(|path| page_number(path));
        assert_eq!(
            paths,
            ["page-1.png", "page-2.png", "page-10.png"]
                .map(PathBuf::from)
                .to_vec()
        );
    }

    #[test]
    fn a_document_with_no_pages_is_an_error() {
        let root = scratch("empty");
        assert!(matches!(
            project_from_pages("x", &[], &root),
            Err(DocumentError::NoPages)
        ));
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn file_names_are_sanitised() {
        assert_eq!(
            stem_of(Path::new("/tmp/Sermon Notes #2.pdf")),
            "Sermon_Notes__2"
        );
        assert_eq!(page_number(Path::new("page-0042.png")), 42);
        assert_eq!(page_number(Path::new("page.png")), 0);
    }
}
