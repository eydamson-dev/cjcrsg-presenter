//! Copying external media into a project so it becomes portable.
//!
//! An imported FreeShow project points at files in FreeShow's central media
//! folder. That project cannot be shared or zipped until those files live
//! inside it, with relative paths (DEV-004). Copying is deliberately a separate
//! step from import: importing should never move a file on the user's disk
//! without being asked.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::domain::Project;
use crate::media::{MediaAsset, MediaOrigin};

/// Where copied files go, relative to the project root.
pub const BUNDLE_DIR: &str = "media";

/// What happened to one project's media.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct BundleReport {
    /// Assets that are now bundled, in the order they were first seen.
    pub bundled: Vec<String>,
    /// Assets whose source could not be found. They stay `External` and the
    /// project still opens; this is a user problem, not a corrupt file.
    pub missing: Vec<String>,
    /// Assets that could not be copied, with the reason. Also left untouched.
    pub failed: Vec<(String, String)>,
    /// Assets that were already bundled and needed no work.
    pub unchanged: usize,
}

impl BundleReport {
    pub fn copied(&self) -> usize {
        self.bundled.len()
    }
}

/// Copy every external asset into `<root>/media` and rewrite it to a relative
/// `Bundled` path.
///
/// Ids can appear in both `project.media` and a show's `media`; one file is
/// copied once and every occurrence is rewritten.
pub fn bundle_media(project: &mut Project, project_root: &Path) -> BundleReport {
    let mut report = BundleReport::default();
    // A show imported on its own carries its media only on the show; bundle and
    // report against the project-wide list.
    project.collect_media();

    // Resolve each unique external asset once, so a file referenced by two
    // shows is not copied twice.
    let mut sources: BTreeMap<String, PathBuf> = BTreeMap::new();
    let mut seen: BTreeMap<String, MediaAsset> = BTreeMap::new();

    let all = project
        .media
        .iter()
        .chain(project.shows.iter().flat_map(|show| show.media.iter()));

    for asset in all {
        if asset.origin == MediaOrigin::Bundled {
            continue;
        }
        if seen.contains_key(&asset.id) {
            continue;
        }
        seen.insert(asset.id.clone(), asset.clone());
        sources.insert(asset.id.clone(), source_path(asset, project_root));
    }

    let mut rewritten: BTreeMap<String, MediaAsset> = BTreeMap::new();
    let media_dir = project_root.join(BUNDLE_DIR);

    for (id, asset) in &seen {
        let source = &sources[id];
        if !source.is_file() {
            report.missing.push(id.clone());
            continue;
        }

        match copy_into(&media_dir, id, source) {
            Ok(path) => {
                let mut bundled = asset.clone();
                bundled.origin = MediaOrigin::Bundled;
                bundled.path = path;
                bundled.size = std::fs::metadata(source).ok().map(|meta| meta.len());
                bundled.relink_hint = Some(asset.path.clone());
                rewritten.insert(id.clone(), bundled);
                report.bundled.push(id.clone());
            }
            Err(error) => report.failed.push((id.clone(), error.to_string())),
        }
    }

    // Rewrite every occurrence, in both the project list and each show.
    for asset in project.media.iter_mut() {
        rewrite(asset, &rewritten, &mut report);
    }
    for show in project.shows.iter_mut() {
        for asset in show.media.iter_mut() {
            rewrite(asset, &rewritten, &mut report);
        }
    }

    report
}

fn rewrite(
    asset: &mut MediaAsset,
    rewritten: &BTreeMap<String, MediaAsset>,
    report: &mut BundleReport,
) {
    if asset.origin == MediaOrigin::Bundled {
        // Counted once per project, not once per occurrence.
        if !rewritten.contains_key(&asset.id) {
            report.unchanged += 1;
        }
        return;
    }
    if let Some(replacement) = rewritten.get(&asset.id) {
        *asset = replacement.clone();
    }
}

/// An external path may be absolute or relative to the project root.
fn source_path(asset: &MediaAsset, project_root: &Path) -> PathBuf {
    let path = Path::new(&asset.path);
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        project_root.join(path)
    }
}

/// Copy `source` into `media_dir`, returning the forward-slashed relative path.
///
/// A name that is already taken by a different file gets the asset id appended
/// rather than being overwritten: silently replacing a file the user put there
/// is worse than an uglier name.
fn copy_into(media_dir: &Path, id: &str, source: &Path) -> std::io::Result<String> {
    std::fs::create_dir_all(media_dir)?;

    let base = source
        .file_name()
        .and_then(|name| name.to_str())
        .map(sanitise)
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| format!("media-{}", sanitise(id)));

    let mut name = base.clone();
    let mut attempt = 0;
    loop {
        let destination = media_dir.join(&name);
        if !destination.exists() || same_file(source, &destination) {
            break;
        }
        attempt += 1;
        name = match attempt {
            1 => with_suffix(&base, &sanitise(id)),
            n => with_suffix(&base, &format!("{}-{n}", sanitise(id))),
        };
        if attempt > 100 {
            return Err(std::io::Error::other("too many files with the same name"));
        }
    }

    let destination = media_dir.join(&name);
    if !same_file(source, &destination) {
        std::fs::copy(source, &destination)?;
    }
    Ok(format!("{BUNDLE_DIR}/{name}"))
}

fn same_file(a: &Path, b: &Path) -> bool {
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

/// Keep a file name usable on every platform we support.
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

fn with_suffix(name: &str, suffix: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, extension)) if !stem.is_empty() => format!("{stem}-{suffix}.{extension}"),
        _ => format!("{name}-{suffix}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Show, Slide, SlideGroup};
    use crate::media::MediaKind;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cjcp-bundle-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(path: &Path, bytes: &[u8]) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, bytes).unwrap();
    }

    fn project_with(media: Vec<MediaAsset>, show_media: Vec<MediaAsset>) -> Project {
        Project {
            id: "p".into(),
            name: "n".into(),
            media,
            shows: vec![Show {
                id: "s".into(),
                name: "S".into(),
                groups: vec![SlideGroup {
                    id: "g".into(),
                    name: "G".into(),
                    slides: vec![Slide {
                        id: "sl".into(),
                        name: "1".into(),
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                media: show_media,
                ..Default::default()
            }],
            ..Default::default()
        }
    }

    #[test]
    fn an_external_file_is_copied_and_becomes_a_relative_bundled_asset() {
        let root = scratch("one");
        let source = root.join("outside/worship.mp4");
        write(&source, b"video bytes");

        let external =
            MediaAsset::external("m1", MediaKind::Video, source.to_string_lossy().to_string());
        let mut project = project_with(vec![external], vec![]);

        let report = bundle_media(&mut project, &root);
        assert_eq!(report.bundled, ["m1"]);
        assert!(report.missing.is_empty());

        let asset = &project.media[0];
        assert_eq!(asset.origin, MediaOrigin::Bundled);
        assert_eq!(asset.path, "media/worship.mp4");
        assert_eq!(asset.size, Some(11));
        assert!(asset.validate().is_ok());
        assert_eq!(
            std::fs::read(root.join("media/worship.mp4")).unwrap(),
            b"video bytes"
        );
        assert!(
            asset
                .relink_hint
                .as_deref()
                .unwrap()
                .ends_with("outside/worship.mp4"),
            "the original location is kept as a hint"
        );

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn one_file_referenced_by_the_project_and_a_show_is_copied_once() {
        let root = scratch("dedupe");
        let source = root.join("logo.png");
        write(&source, b"png");

        let asset =
            MediaAsset::external("m1", MediaKind::Image, source.to_string_lossy().to_string());
        let mut project = project_with(vec![asset.clone()], vec![asset]);

        let report = bundle_media(&mut project, &root);
        assert_eq!(report.copied(), 1);
        assert_eq!(project.media[0].path, "media/logo.png");
        assert_eq!(project.shows[0].media[0].path, "media/logo.png");

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_missing_source_is_reported_and_left_external() {
        let root = scratch("missing");
        let asset = MediaAsset::external("gone", MediaKind::Video, "/srv/media/gone.mp4");
        let mut project = project_with(vec![asset], vec![]);

        let report = bundle_media(&mut project, &root);
        assert_eq!(report.missing, ["gone"]);
        assert_eq!(project.media[0].origin, MediaOrigin::External);
        assert_eq!(project.media[0].path, "/srv/media/gone.mp4");

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn running_twice_copies_nothing_the_second_time() {
        let root = scratch("twice");
        let source = root.join("a.mp3");
        write(&source, b"audio");

        let asset =
            MediaAsset::external("m1", MediaKind::Audio, source.to_string_lossy().to_string());
        let mut project = project_with(vec![asset], vec![]);

        bundle_media(&mut project, &root);
        let second = bundle_media(&mut project, &root);
        assert_eq!(second.copied(), 0);
        assert!(second.bundled.is_empty());
        assert_eq!(
            second.unchanged, 1,
            "already-bundled assets are counted once"
        );

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn two_assets_with_the_same_file_name_do_not_overwrite_each_other() {
        let root = scratch("collision");
        let a = root.join("a/bg.jpg");
        let b = root.join("b/bg.jpg");
        write(&a, b"first");
        write(&b, b"second");

        let mut project = project_with(
            vec![
                MediaAsset::external("m1", MediaKind::Image, a.to_string_lossy().to_string()),
                MediaAsset::external("m2", MediaKind::Image, b.to_string_lossy().to_string()),
            ],
            vec![],
        );

        let report = bundle_media(&mut project, &root);
        assert_eq!(report.copied(), 2);

        let first = &project.media[0];
        let second = &project.media[1];
        assert_ne!(first.path, second.path);
        assert_eq!(std::fs::read(root.join(&first.path)).unwrap(), b"first");
        assert_eq!(std::fs::read(root.join(&second.path)).unwrap(), b"second");

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_source_already_inside_the_bundle_folder_is_not_copied_onto_itself() {
        let root = scratch("inside");
        let source = root.join("media/logo.png");
        write(&source, b"png");

        let asset =
            MediaAsset::external("m1", MediaKind::Image, source.to_string_lossy().to_string());
        let mut project = project_with(vec![asset], vec![]);

        let report = bundle_media(&mut project, &root);
        assert_eq!(report.bundled, ["m1"]);
        assert_eq!(project.media[0].path, "media/logo.png");
        assert_eq!(std::fs::read(&source).unwrap(), b"png");

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn file_names_are_sanitised_but_keep_their_extension() {
        assert_eq!(sanitise("wor ship:1.mp4"), "wor_ship_1.mp4");
        assert_eq!(sanitise("bg.jpg"), "bg.jpg");
        assert_eq!(with_suffix("bg.jpg", "m2"), "bg-m2.jpg");
        assert_eq!(with_suffix("noext", "m2"), "noext-m2");
    }

    #[test]
    fn a_relative_external_path_is_resolved_against_the_project_root() {
        let root = scratch("relative");
        write(&root.join("shots/one.png"), b"png");

        let asset = MediaAsset::external("m1", MediaKind::Image, "shots/one.png");
        let mut project = project_with(vec![asset], vec![]);

        let report = bundle_media(&mut project, &root);
        assert_eq!(report.bundled, ["m1"]);
        assert_eq!(project.media[0].path, "media/one.png");

        std::fs::remove_dir_all(&root).ok();
    }
}
